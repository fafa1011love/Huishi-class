import React, { useState } from 'react';
import { Brain, ClipboardCheck, Eye, EyeOff, HelpCircle, Loader2, Play, Route, Settings2 } from 'lucide-react';
import { AgentRole, AgentStatus, AgentTimelineItem } from '../types';
import XiaozhiMascot from './XiaozhiMascot';

interface MultiAgentPanelProps {
  statuses: Record<AgentRole, AgentStatus>;
  timeline: AgentTimelineItem[];
  summary: string;
  thinking: string;
  isRunning: boolean;
  onStart: (request: string) => void;
  embedded?: boolean;
}

const roleMeta: Record<AgentRole, { title: string; icon: React.ReactNode; text: string; border: string; background: string; glow: string }> = {
  orchestrator: { title: '小智总调度Agent', icon: <XiaozhiMascot size={14} motion="static" />, text: 'text-cyan-200', border: 'border-cyan-300/20', background: 'bg-cyan-300/[0.065]', glow: 'shadow-[0_0_20px_rgba(34,211,238,0.11)]' },
  planner: { title: '理解规划Agent', icon: <Brain size={14} />, text: 'text-indigo-200', border: 'border-indigo-300/20', background: 'bg-indigo-400/[0.065]', glow: 'shadow-[0_0_20px_rgba(129,140,248,0.11)]' },
  executor: { title: '演示执行Agent', icon: <Settings2 size={14} />, text: 'text-emerald-200', border: 'border-emerald-300/20', background: 'bg-emerald-400/[0.06]', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.10)]' },
  evaluator: { title: '知识讲解Agent', icon: <ClipboardCheck size={14} />, text: 'text-amber-200', border: 'border-amber-300/20', background: 'bg-amber-400/[0.06]', glow: 'shadow-[0_0_20px_rgba(251,191,36,0.10)]' },
  questioner: { title: '活泼追问Agent', icon: <HelpCircle size={14} />, text: 'text-pink-200', border: 'border-pink-300/20', background: 'bg-pink-400/[0.06]', glow: 'shadow-[0_0_20px_rgba(244,114,182,0.10)]' },
};

const statusText: Record<AgentStatus, string> = {
  idle: '待命',
  thinking: '规划中',
  running: '执行中',
  done: '完成',
  error: '异常',
};

const MultiAgentPanel: React.FC<MultiAgentPanelProps> = ({ statuses, timeline, summary, thinking, isRunning, onStart, embedded = false }) => {
  const [request, setRequest] = useState('讲解地球内部结构，展示地壳、地幔、外核和内核的关系');
  const [isHidden, setIsHidden] = useState(false);

  const handleStart = () => {
    const trimmedRequest = request.trim();

    if (isRunning || !trimmedRequest) {
      return;
    }

    onStart(trimmedRequest);
  };

  const handleRequestKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) {
      return;
    }

    event.preventDefault();
    handleStart();
  };

  if (isHidden && !embedded) {
    return (
      <button
        type="button"
        onClick={() => setIsHidden(false)}
        className="absolute top-6 left-6 z-50 flex h-12 items-center gap-2 rounded-2xl border border-cyan-300/20 bg-[#061522]/90 px-4 text-xs font-black text-cyan-50 shadow-[0_18px_46px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl transition hover:border-cyan-300/35 hover:bg-[#082033]/95 hover:text-white"
        aria-label="显示多智能体协作台"
        title="显示多智能体协作台"
      >
        {isRunning ? <Loader2 size={16} className="animate-spin text-cyan-300" /> : <Route size={16} className="text-cyan-300" />}
        <span>多智能体</span>
        <Eye size={15} className="text-slate-500" />
      </button>
    );
  }

  return (
    <div className={embedded
      ? 'w-full rounded-2xl border border-cyan-300/15 bg-[#061725]/85 p-3 text-white shadow-lg'
      : `absolute top-6 left-6 z-50 max-w-[calc(100%-3rem)] overflow-hidden rounded-3xl border border-cyan-300/20 bg-[linear-gradient(155deg,rgba(8,29,47,0.96),rgba(3,13,24,0.94))] text-white shadow-[0_26px_70px_rgba(0,0,0,0.55),0_0_36px_rgba(34,211,238,0.06),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-2xl transition-all before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-cyan-200/30 before:to-transparent ${isRunning || timeline.length > 0 ? 'w-[310px] p-3' : 'w-[360px] p-4'}`
    }>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-cyan-50">
            <Route size={16} className="text-cyan-300" />
            Agent 实时运行记录
          </div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-100/35">Plan · Tool Use · Summary</div>
        </div>
        {!embedded && <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setIsHidden(true)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/10 bg-white/[0.035] text-slate-400 shadow-sm transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-cyan-100"
            aria-label="隐藏多智能体协作台"
            title="隐藏多智能体协作台"
          >
            <EyeOff size={17} />
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={handleStart}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/35 bg-cyan-300/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)] transition hover:border-cyan-200/55 hover:bg-cyan-300/25 hover:text-white disabled:cursor-not-allowed disabled:border-slate-600/20 disabled:bg-slate-700/20 disabled:text-slate-500 disabled:shadow-none"
            aria-label="启动多智能体演示"
            title="启动多智能体演示"
          >
            {isRunning ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
          </button>
        </div>}
      </div>

      {!embedded && <textarea
        value={request}
        disabled={isRunning}
        onChange={(event) => setRequest(event.target.value)}
        onKeyDown={handleRequestKeyDown}
        className={`mb-3 w-full resize-none rounded-2xl border border-cyan-300/12 bg-[#04111e]/80 px-3 py-2 text-xs font-medium leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 focus:bg-[#061827]/90 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-55 ${isRunning || timeline.length > 0 ? 'h-12' : 'h-20'}`}
        placeholder="输入教学需求，按 Enter 开始，Shift+Enter 换行"
        title="按 Enter 开始，Shift+Enter 换行"
      />}

      <div className={`grid gap-2 ${embedded ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {(Object.keys(roleMeta) as AgentRole[]).map((role) => (
          <div
            key={role}
            className={`relative overflow-hidden rounded-2xl border p-2 ${roleMeta[role].border} ${roleMeta[role].background} ${roleMeta[role].text} ${statuses[role] === 'running' || statuses[role] === 'thinking'
              ? `${roleMeta[role].glow} ring-1 ring-current/10 after:pointer-events-none after:absolute after:inset-0 after:animate-pulse after:rounded-[inherit] after:border after:border-current/15`
              : statuses[role] === 'error'
                ? 'border-rose-300/30 text-rose-200'
                : statuses[role] === 'done'
                  ? 'opacity-95'
                  : 'opacity-65'
            }`}
          >
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black">
              {roleMeta[role].icon}
              <span className="truncate">{roleMeta[role].title.replace('Agent', '')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold">
              <span className={`h-1.5 w-1.5 rounded-full ${statuses[role] === 'running' || statuses[role] === 'thinking' ? 'animate-pulse bg-current' : 'bg-current opacity-50'}`} />
              {statusText[statuses[role]]}
            </div>
          </div>
        ))}
      </div>

      {thinking && (
        <div className={`mt-3 rounded-2xl border px-3 py-2 ${embedded ? 'border-cyan-300/12 bg-cyan-300/[0.055]' : 'border-indigo-300/15 bg-indigo-400/[0.055] shadow-[inset_3px_0_0_rgba(129,140,248,0.48)]'}`}>
          <div className={`mb-1 flex items-center gap-1.5 text-[10px] font-black ${embedded ? 'text-cyan-200/80' : 'text-indigo-200'}`}>
            <Brain size={13} />
            Agent 思考
          </div>
          <p className={`text-[11px] font-medium leading-relaxed ${embedded ? 'text-white/48' : 'text-slate-300/80'}`}>{thinking}</p>
        </div>
      )}

      <div className={`mt-3 space-y-1.5 overflow-y-auto pr-1 ${embedded ? 'max-h-64' : isRunning || timeline.length > 0 ? 'max-h-24' : 'max-h-36'}`}>
        {timeline.length === 0 ? (
          <div className={`rounded-2xl border px-3 py-3 text-[11px] font-medium ${embedded ? 'border-cyan-300/8 bg-[#061522]/80 text-cyan-100/38' : 'border-cyan-300/8 bg-[#04111d]/65 text-slate-500'}`}>
            等待输入教学需求，智能体会生成演示步骤并调用3D工具。
          </div>
        ) : (
          timeline.map((item) => (
            <div key={item.id} className={`rounded-2xl border px-3 py-2 ${embedded ? 'border-cyan-300/10 bg-cyan-950/25' : 'border-cyan-300/10 bg-[#061522]/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[9px] font-black ${embedded ? 'text-cyan-300/70' : 'text-cyan-200/55'}`}>{roleMeta[item.agent].title}</span>
                <span className={`text-[9px] font-black uppercase ${item.status === 'error' ? 'text-rose-400' : item.status === 'done' ? 'text-emerald-400' : item.status === 'running' ? 'text-cyan-400' : 'text-gray-400'}`}>{statusText[item.status === 'pending' ? 'idle' : item.status === 'running' ? 'running' : item.status === 'error' ? 'error' : 'done']}</span>
              </div>
              <div className={`mt-1 text-[10px] font-black ${embedded ? 'text-white/80' : 'text-slate-200'}`}>{item.title}</div>
              <p className={`mt-0.5 line-clamp-2 text-[10px] font-medium leading-relaxed ${embedded ? 'text-white/45' : 'text-slate-400'}`}>{item.detail}</p>
            </div>
          ))
        )}
      </div>

      {summary && (
        <div className={`mt-3 rounded-2xl border px-3 py-2 ${embedded ? 'border-cyan-300/12 bg-[#071c2a]/90' : 'border-amber-300/15 bg-amber-400/[0.045] shadow-[inset_3px_0_0_rgba(251,191,36,0.42)]'}`}>
          <div className={`mb-1 flex items-center gap-1.5 text-[10px] font-black ${embedded ? 'text-cyan-200/75' : 'text-amber-200'}`}>
            <ClipboardCheck size={13} />
            知识讲解
          </div>
          <p className={`text-[11px] font-medium leading-relaxed ${embedded ? 'line-clamp-4 text-white/45' : 'text-slate-300/80'}`}>{summary}</p>
        </div>
      )}
    </div>
  );
};

export default MultiAgentPanel;
