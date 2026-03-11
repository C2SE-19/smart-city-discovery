import SectionCard from '../../components/common/SectionCard';
import StatCard from '../../components/common/StatCard';
import TagPill from '../../components/common/TagPill';
import {
  backendTracks,
  frontendTracks,
  projectStats,
  roleStreams,
  sprintBoard
} from '../../app/navigation';

function OverviewPage() {
  return (
    <div className="page">
      <section className="hero-grid">
        <div className="hero-panel hero-panel-primary">
          <p className="hero-kicker">Project skeleton</p>
          <h1 className="hero-title">Frontend and backend are now split by role and by feature.</h1>
          <p className="hero-copy">
            Team co the chia viec theo folder, khong can tranh nhau trong mot file App hay mot file server duy nhat nua.
          </p>
          <div className="pill-row">
            <TagPill>User Discovery</TagPill>
            <TagPill>Merchant Workflow</TagPill>
            <TagPill>Admin GIS</TagPill>
            <TagPill muted>AI contracts ready</TagPill>
          </div>
        </div>

        <div className="hero-stats">
          {projectStats.map((item) => (
            <StatCard key={item.label} label={item.label} trend={item.trend} value={item.value} />
          ))}
        </div>
      </section>

      <SectionCard
        eyebrow="Role architecture"
        title="Three tracks mapped directly from your proposal"
        description="Moi role co page rieng de team frontend boc UI, team backend boc API va business logic song song."
      >
        <div className="split-grid">
          {roleStreams.map((stream) => (
            <article key={stream.title} className="assignment-card">
              <p className="assignment-eyebrow">{stream.eyebrow}</p>
              <h3 className="assignment-title">{stream.title}</h3>
              <p className="assignment-description">{stream.description}</p>

              <div className="assignment-points">
                {stream.points.map((point) => (
                  <TagPill key={point} muted>
                    {point}
                  </TagPill>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="two-column-grid">
        <SectionCard
          eyebrow="Frontend split"
          title="Folders to assign for frontend members"
          description="Moi member nhan mot feature folder, giu shared layout va map component chung."
        >
          <div className="assignment-grid">
            {frontendTracks.map((track) => (
              <article key={track.title} className="assignment-row">
                <div>
                  <h3 className="assignment-title">{track.title}</h3>
                  <p className="assignment-folder">{track.folder}</p>
                </div>
                <p className="assignment-owner">{track.owner}</p>
                <p className="assignment-description">{track.scope}</p>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Backend split"
          title="Folders to assign for backend or AI members"
          description="Core GIS module duoc tach rieng de giu on dinh, cac module chua lam da co contracts va routes khung."
        >
          <div className="assignment-grid">
            {backendTracks.map((track) => (
              <article key={track.title} className="assignment-row">
                <div>
                  <h3 className="assignment-title">{track.title}</h3>
                  <p className="assignment-folder">{track.folder}</p>
                </div>
                <p className="assignment-owner">{track.owner}</p>
                <p className="assignment-description">{track.scope}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Sprint framing"
        title="Delivery board to align the team"
        description="Dung bang nay de chia ai code gi trong tung sprint ma van giu dung thu tu uu tien."
      >
        <div className="split-grid">
          {sprintBoard.map((sprint) => (
            <article key={sprint.title} className="sprint-card">
              <div className="sprint-card-header">
                <h3 className="assignment-title">{sprint.title}</h3>
                <TagPill>{sprint.status}</TagPill>
              </div>

              <div className="assignment-points">
                {sprint.deliverables.map((item) => (
                  <TagPill key={item} muted>
                    {item}
                  </TagPill>
                ))}
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default OverviewPage;
