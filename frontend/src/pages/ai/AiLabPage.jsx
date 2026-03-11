import SectionCard from '../../components/common/SectionCard';
import TagPill from '../../components/common/TagPill';
import { aiContracts } from '../../app/navigation';

function AiLabPage() {
  return (
    <div className="page">
      <SectionCard
        eyebrow="AI integration"
        title="Contracts first, model implementation second"
        description="Trang nay giup AI member, backend member va frontend member thong nhat payload truoc khi code model service rieng."
      >
        <div className="split-grid">
          {aiContracts.map((contract) => (
            <article key={contract.title} className="assignment-card">
              <p className="assignment-eyebrow">Endpoint</p>
              <h3 className="assignment-title">{contract.title}</h3>
              <p className="assignment-folder">{contract.endpoint}</p>
              <div className="assignment-points">
                <TagPill muted>Input: {contract.payload}</TagPill>
                <TagPill muted>Output: {contract.output}</TagPill>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <div className="two-column-grid">
        <SectionCard
          eyebrow="Recommended split"
          title="How to divide the AI work"
          description="Neu team it nguoi, chia theo contract thay vi chia theo model."
        >
          <div className="assignment-points">
            <TagPill>AI service API design</TagPill>
            <TagPill>Model experiment and dataset</TagPill>
            <TagPill>Backend orchestration layer</TagPill>
            <TagPill>Frontend explanation and upload UX</TagPill>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Current note"
          title="Repo status"
          description="Thu muc ai-service hien chua co code, nen dung trang nay lam diem xuat phat de AI member tiep tuc tach service Flask hoac FastAPI."
        >
          <div className="assignment-points">
            <TagPill muted>/ai/recommend</TagPill>
            <TagPill muted>/ai/image-recognition</TagPill>
            <TagPill muted>/ai/chat</TagPill>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default AiLabPage;
