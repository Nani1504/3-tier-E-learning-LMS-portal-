export default function ProgressBar({ percent }) {
  return (
    <div className="progressbar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="progressbar-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
