import { get } from '../../api';
import { ErrorBox, Loading, useApp, useAsync } from '../../ui/kit';
import { ProfileView } from '../teacher/ClassView';

export function Progress() {
  const { user } = useApp();
  const { data, error, loading, reload } = useAsync(() => get(`/api/students/${user.id}/profile`), [user.id]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <div className="stack">
      <h1>Tiến bộ của em</h1>
      <ProfileView data={data} self />
    </div>
  );
}
