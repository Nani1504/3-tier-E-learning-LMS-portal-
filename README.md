# Aviz Academy — 3-Tier E-Learning & Course Management System (LMS)

<p align="center"><img src="aviz-logo.png" alt="Aviz Academy" width="280" /></p>

A capstone-ready, containerized Learning Management System designed to showcase
a full **3-tier architecture on Kubernetes**: a React frontend, a Node.js/Express
REST API, and a PostgreSQL database with **Amazon EFS shared storage**
(ReadWriteMany) for video content.

```
┌──────────────┐      ┌──────────────────┐      ┌──────────────────────┐
│  React (Vite)│  →   │ Node.js + Express│  →   │ PostgreSQL (Stateful)│
│  nginx SPA   │ /api │  JWT + RBAC API  │      │ EFS (lesson videos,  │
└──────────────┘      └──────────────────┘      │  RWX across replicas)│
      Tier 1                 Tier 2             └──────────────────────┘
                                                        Tier 3
```

Every backend replica mounts the **same EFS file system** at `/data/videos`.
A video uploaded through any pod is instantly served by all the others — even
as the HPA scales the Deployment across nodes. That is the EFS story:
**ReadWriteMany**, which single-node EBS volumes cannot do.

## Features

| Area | What it does |
|------|--------------|
| **Auth & Roles** | Signup/login for **Students** and **Instructors**, JWT-based auth, role-based access control on the API |
| **Course Management** | Instructors create courses and lessons; students browse the public catalog |
| **Enrollments** | Students enroll and see a personalized "My Courses" list |
| **Video Content** | Upload one video per lesson to shared EFS storage; the API streams it back (HTTP Range) in the UI |
| **Progress Tracking** | Mark lessons complete; per-course completion percentage everywhere |

### Data model

`Users` → `Courses` → `Lessons`, with `Enrollments` (student ↔ course) and
`Progress` (student ↔ lesson). Full schema in
[`backend/db/init.sql`](backend/db/init.sql).

### Demo accounts (seeded)

| Role | Email | Password |
|------|-------|----------|
| Instructor | `alice@lms.dev` | `password123` |
| Student | `bob@lms.dev` | `password123` |

---

## Repository layout

```
.
├── backend/            # Node.js + Express REST API
│   ├── src/            # routes, middleware, db + storage clients
│   ├── db/init.sql     # schema + seed data
│   └── Dockerfile      # multi-stage, non-root
├── frontend/           # React (Vite) SPA
│   ├── src/            # pages, components, auth context, api client
│   ├── nginx.conf      # serves SPA + proxies /api
│   └── Dockerfile      # multi-stage, non-root (nginx-unprivileged)
├── k8s/                # Kubernetes manifests (apply with kustomize)
├── docker-compose.yml  # one-command local stack
└── README.md
```

---

## Option A — Run locally with Docker Compose

Fastest way to see the whole system end-to-end.

```bash
docker compose up --build
```

Then open:

- **App:** http://localhost:8080
- **API:** http://localhost:4000

Log in as `alice@lms.dev` to create courses/lessons and upload videos, then as
`bob@lms.dev` to enroll and track progress. Videos are stored on the
`videodata` named volume — the local stand-in for the EFS volume used on
Kubernetes.

Tear down (and wipe volumes):

```bash
docker compose down -v
```

### Run tiers individually (without Docker)

```bash
# Backend (needs Postgres reachable; see backend/.env.example)
cd backend && npm install && cp .env.example .env && npm run dev

# Frontend (proxies /api to http://localhost:4000)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

---

## Option B — Deploy to Kubernetes (EKS)

Built for **EKS with Amazon EFS** as the shared video store and an **AWS
Application Load Balancer** (via the AWS Load Balancer Controller) as the
ingress, with HTTPS from ACM. You need `kubectl`, `helm`, and
**metrics-server** (for the HPA). *(On kind/minikube, see the note inside
[`k8s/04-efs-storage.yaml`](k8s/04-efs-storage.yaml) to swap the EFS claim
for a local RWO volume, and change the Ingress to your local controller —
ALB only exists on AWS.)*

Install the AWS Load Balancer Controller (classroom-simple node-role
permissions; use IRSA in production):

```bash
curl -sO https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json      # skip if it already exists
aws iam attach-role-policy --role-name <NODE_ROLE_NAME> \
  --policy-arn arn:aws:iam::<ACCOUNT_ID>:policy/AWSLoadBalancerControllerIAMPolicy

helm repo add eks https://aws.github.io/eks-charts && helm repo update eks
helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system --set clusterName=ekswithavinash \
  --set region=ap-south-1 --set vpcId=<VPC_ID>
```

Then set **your** ACM certificate ARN and domain in
[`k8s/08-ingress.yaml`](k8s/08-ingress.yaml).

### 0. One-time AWS prerequisites for EFS

Follow the **"EKS + EFS: Shared Storage"** classroom guide for the full
commands. In short:

```bash
# 1. Create the EFS file system in the cluster's VPC
aws efs create-file-system --creation-token lms-videos \
  --performance-mode generalPurpose --throughput-mode elastic \
  --tags Key=Name,Value=lms-videos --region ap-south-1

# 2. One mount target per node AZ, with an SG allowing NFS 2049 from the VPC CIDR
aws efs create-mount-target --file-system-id <FS_ID> \
  --subnet-id <NODE_SUBNET> --security-groups <EFS_SG_ID> --region ap-south-1

# 3. Install the EFS CSI driver add-on
aws eks create-addon --cluster-name ekswithavinash \
  --addon-name aws-efs-csi-driver --region ap-south-1

# 4. Let the nodes use it (classroom-simple; use IRSA/Pod Identity in prod)
aws iam attach-role-policy --role-name <NODE_ROLE_NAME> \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEFSCSIDriverPolicy
```

Postgres still uses EBS, so you also need the **EBS CSI driver** add-on (with
`AmazonEBSCSIDriverPolicy` on the node role) — and note that recent EKS
clusters ship `gp2` **without** marking it default, which leaves the Postgres
PVC Pending:

```bash
aws eks create-addon --cluster-name ekswithavinash \
  --addon-name aws-ebs-csi-driver --region ap-south-1
kubectl patch storageclass gp2 -p \
  '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

Then put **your** `FileSystemId` in
[`k8s/04-efs-storage.yaml`](k8s/04-efs-storage.yaml) (the `fileSystemId`
parameter of the `efs-sc` StorageClass).

### 1. Build and push images

Easiest: the included script creates the ECR repos (in `ap-south-1` by
default), builds both images, pushes them, and rewrites the `image:` lines in
`k8s/full-deploy.yaml`:

```bash
IMAGE_TAG=1.1.0 ./scripts/push-to-ecr.sh
```

Or manually:

```bash
# Point at your registry (ECR, Docker Hub, GHCR, …)
export REGISTRY=<acct>.dkr.ecr.ap-south-1.amazonaws.com   # or docker.io/avizway

docker build -t $REGISTRY/aviz-backend:1.1.0 ./backend
docker build -t $REGISTRY/aviz-frontend:1.1.0 ./frontend
docker push $REGISTRY/aviz-backend:1.1.0
docker push $REGISTRY/aviz-frontend:1.1.0
```

Update the `image:` fields in
[`k8s/05-backend.yaml`](k8s/05-backend.yaml) and
[`k8s/07-frontend.yaml`](k8s/07-frontend.yaml) to match.
*(On kind/minikube you can skip the registry and load images directly, e.g.
`kind load docker-image aviz-backend:latest`.)*

### 2. Review config & secrets

- Non-secret settings: [`k8s/01-configmap.yaml`](k8s/01-configmap.yaml)
- Credentials (DB, JWT): [`k8s/02-secrets.yaml`](k8s/02-secrets.yaml) —
  **change these before any real use.**

### 3. Apply everything

```bash
kubectl apply -k k8s/
kubectl get pods -n lms -w
```

Order is handled by readiness probes: Postgres comes up first, then the
backend becomes ready once the DB responds, then the frontend. Check that the
video claim bound (dynamic provisioning creates an EFS Access Point):

```bash
kubectl get sc,pvc -n lms     # lms-videos should be "Bound"
```

### 4. Access the app

The AWS Load Balancer Controller provisions an ALB for the Ingress (~2–3
minutes). Point your Route53 domain at it with an **alias A record**:

```bash
# ADDRESS = the ALB's DNS name once provisioned
kubectl get ingress -n lms

ALB_DNS=$(kubectl get ingress lms-ingress -n lms \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
ALB_ZONE=$(aws elbv2 describe-load-balancers --region ap-south-1 \
  --query "LoadBalancers[?DNSName=='$ALB_DNS'].CanonicalHostedZoneId" --output text)
aws route53 change-resource-record-sets --hosted-zone-id <YOUR_ZONE_ID> \
  --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{
    \"Name\":\"awswithavinashreddy.com\",\"Type\":\"A\",
    \"AliasTarget\":{\"HostedZoneId\":\"$ALB_ZONE\",\"DNSName\":\"$ALB_DNS\",
    \"EvaluateTargetHealth\":false}}}]}"
```

Open **https://awswithavinashreddy.com** — plain HTTP redirects to HTTPS.

> Video playback note: the backend serves videos itself from the shared EFS
> volume at `/api/videos/...`, through the same host as the app — no second
> ingress host or public object store needed.

---

## Kubernetes showcase — what to point at in a demo

| Requirement | Where |
|-------------|-------|
| **Multi-stage, non-root Dockerfiles** | [`backend/Dockerfile`](backend/Dockerfile), [`frontend/Dockerfile`](frontend/Dockerfile) |
| **Deployments / Services** | `k8s/05-backend.yaml`, `k8s/07-frontend.yaml` |
| **ConfigMaps + Secrets** | `k8s/01-configmap.yaml`, `k8s/02-secrets.yaml` |
| **StatefulSet + PVC (persistence)** | `k8s/03-postgres.yaml` (`volumeClaimTemplates`) |
| **EFS shared storage (RWX + CSI + dynamic provisioning)** | `k8s/04-efs-storage.yaml` (StorageClass + ReadWriteMany PVC) |
| **Liveness / readiness probes** | every workload manifest |
| **Resource requests/limits** | every workload manifest |
| **HPA (autoscaling)** | `k8s/06-backend-hpa.yaml` |
| **Ingress** | `k8s/08-ingress.yaml` |

### Demonstrate autoscaling (HPA)

```bash
# Watch the autoscaler
kubectl get hpa -n lms -w

# In another terminal, generate CPU load against the backend
kubectl run -n lms load --rm -it --image=busybox --restart=Never -- \
  /bin/sh -c "while true; do wget -q -O- http://backend:4000/api/courses; done"
```

Watch `REPLICAS` climb from 2 toward 10 as CPU passes the 60% target, then scale
back down after the load stops.

### Demonstrate EFS shared storage (RWX)

Upload a lesson video as `alice@lms.dev`, then prove every backend replica
serves the same file from the shared mount:

```bash
# The upload landed on the EFS mount — check from EVERY backend pod
for p in $(kubectl get pods -n lms -l app=backend -o name); do
  echo "== $p"; kubectl exec -n lms $p -- find /data/videos/lessons -type f
done

# Kill the pod that handled the upload — the video still plays afterwards,
# because the file lives on EFS, not in any pod
kubectl delete pod -n lms <one-backend-pod>
```

Scale the backend (or let the HPA do it) and repeat — new pods on any node see
the same files instantly. This is `ReadWriteMany` in action.

### Verify persistence

```bash
kubectl delete pod -n lms postgres-0
kubectl get pods -n lms -w        # postgres-0 reschedules, PVC reattaches
```

Your courses, users, and progress survive the restart because the data lives on
the PersistentVolumeClaim, not the pod. The same applies to videos on the EFS
claim (`lms-videos`).

---

## API reference (brief)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/signup` | – | `{name,email,password,role}` |
| POST | `/api/auth/login` | – | returns `{token,user}` |
| GET | `/api/auth/me` | Bearer | current user |
| GET | `/api/courses` | – | catalog |
| GET | `/api/courses/:id` | – | course + lessons (with `video_url`) |
| POST | `/api/courses` | Instructor | create course |
| GET | `/api/courses/mine/teaching` | Instructor | my courses |
| POST | `/api/courses/:id/lessons` | Instructor (owner) | add lesson |
| POST | `/api/lessons/:id/video` | Instructor (owner) | multipart `video` upload |
| POST | `/api/enrollments` | Student | `{course_id}` |
| GET | `/api/enrollments/mine` | Student | My Courses + progress % |
| GET | `/api/progress/course/:id` | Student | per-lesson completion |
| PUT | `/api/progress/lesson/:id` | Student | `{completed}` |
| GET | `/healthz` / `/readyz` | – | liveness / readiness probes |

---

## Notes & scope

This is a **demo-scoped** system. For production you would additionally want:
authenticated (time-limited) video URLs instead of public streaming, database
migrations (instead of `init.sql`), TLS on the Ingress, a proper secrets
manager, IRSA/Pod Identity for the EFS CSI driver (instead of the node-role
policy), EFS lifecycle policies for cost, and network policies. The current
setup is intentionally straightforward so the Kubernetes concepts stay front
and center.
