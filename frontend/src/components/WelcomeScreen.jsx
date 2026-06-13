import { Shield, FileSearch, Globe, Cpu, ExternalLink } from 'lucide-react'

export default function WelcomeScreen() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-fade-in">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
            <Shield size={32} className="text-blue-400" strokeWidth={1.5} />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-200 mb-2">
            OFAC Sanctions Screening
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Screen payment instructions against the OFAC SDN list with
            full analysis transparency for regulatory review.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            {
              icon: FileSearch,
              title: 'Analysis Pipeline',
              desc: 'See every step — normalization, string similarity, phonetic matching, country signals.',
            },
            {
              icon: Globe,
              title: 'Source Verification',
              desc: 'Direct links to OFAC SDN entries and sanctions program pages for independent verification.',
            },
            {
              icon: Cpu,
              title: 'AI-Explained Decisions',
              desc: 'Score breakdown shows exactly which factors drove each MATCH / REVIEW / NO_MATCH.',
            },
            {
              icon: Shield,
              title: 'Analyst Override',
              desc: 'Manually amend verdicts with documented reasons and analyst ID for audit trails.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-bg-1 border border-slate-800 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <Icon size={14} className="text-blue-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-300">{title}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Data source notice */}
        <div className="bg-bg-1 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-500 text-left space-y-1">
          <div className="font-semibold text-slate-400 mb-1.5">Data Sources</div>
          <div className="flex items-center justify-between">
            <span>OFAC Specially Designated Nationals List</span>
            <a href="https://ofac.treasury.gov/downloads/sdn.xml" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
              SDN XML <ExternalLink size={10} />
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span>OFAC Interactive Search</span>
            <a href="https://sanctionssearch.ofac.treas.gov/" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
              ofac.treas.gov <ExternalLink size={10} />
            </a>
          </div>
          <p className="text-slate-700 mt-2">
            Coverage: ~12,000 SDN entities · ~850 crypto addresses · Updated daily
          </p>
        </div>
      </div>
    </div>
  )
}
