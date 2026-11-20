export default function TasksLoading() {
  return <div className="plots-loading" aria-busy="true">
    <div className="loading-line loading-line-short" /><div className="loading-line loading-line-title" />
    <div className="loading-card-grid"><div className="loading-card" /><div className="loading-card" /><div className="loading-card" /></div>
  </div>;
}
