import React, { useEffect, useRef, useState } from 'react';
type Review = {
  branch: string; remoteLabel: string; files: { path: string; status: string }[]; excluded: string[];
  pendingCommits: string[]; firstSetup: boolean; blocked: string; suggestedMessage: string;
  reviewId: string; includeCode: boolean; canPublish: boolean;
};
async function api<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/portal/git/${path}`, { method:'POST', headers:{'Content-Type':'application/json','X-Mujiz-Portal':'1'}, body:JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '操作失敗');
  return result;
}
export default function GitPublishDialog({ onClose, onBusy }: { onClose: () => void; onBusy: (busy: boolean) => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [includeCode, setIncludeCode] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{status:string;message:string;commit:string} | null>(null);
  const [done, setDone] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = loading || publishing;
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { onBusy(busy); return () => onBusy(false); }, [busy, onBusy]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => { if (publishing) { event.preventDefault(); event.returnValue=''; } };
    window.addEventListener('beforeunload',listener);
    return () => window.removeEventListener('beforeunload',listener);
  }, [publishing]);
  const refresh = async (scope: boolean) => {
    setLoading(true); setError(''); setReview(null); setDone(false);
    try { const next = await api<Review>('review',{includeCode:scope}); setReview(next); setMessage(next.suggestedMessage); }
    catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(includeCode); }, [includeCode]);
  const publish = async () => {
    if (!review || !review.canPublish || busy) return;
    setPublishing(true); setError(''); setResult(null);
    try {
      const next = await api<{status:string;message:string;commit:string}>('publish',{ includeCode, reviewId:review.reviewId, message });
      setResult(next); setDone(true);
    } catch (err) { setError((err as Error).message); setReview(null); }
    finally { setPublishing(false); }
  };
  return <dialog className="git-dialog" ref={dialog} aria-labelledby="git-dialog-title" onCancel={event => { event.preventDefault(); if (!publishing) onClose(); }}>
    <div className="git-dialog-head"><div><span className="eyebrow">GIT UPDATE</span><h2 id="git-dialog-title">檢視、提交並推送</h2></div><button type="button" className="secondary" disabled={publishing} onClick={onClose}>關閉</button></div>
    <p className="git-intro">只會提交以下列出的檔案。既有的本地 commit 也會一併推送，不會強制覆蓋遠端。</p>
    <label className="git-scope"><input type="checkbox" checked={includeCode} disabled={busy} onChange={event=>{ setResult(null);setIncludeCode(event.target.checked); }} />包含網站與 Portal 程式修改</label>
    {loading && <p role="status">正在讀取本機變更與遠端狀態…</p>}
    {error && <div className="notice error" role="alert">{error}</div>}
    {result && <div className={`notice ${result.status === 'push-failed' ? 'error' : ''}`} role="status">{result.message}<br/><small>Commit：{result.commit.slice(0,8)}</small></div>}
    {review && <>
      <dl className="git-target"><dt>分支</dt><dd>{review.branch}</dd><dt>推送至</dt><dd>{review.remoteLabel}</dd></dl>
      {review.firstSetup && <div className="notice">這是內容管理功能的首次更新，請勾選「包含網站與 Portal 程式修改」。之後只改內容時可取消勾選。</div>}
      {review.blocked && <div className="notice error">{review.blocked}</div>}
      <h3>本次提交的檔案 · {review.files.length}</h3>
      <ul className="git-file-list">{review.files.map(file=><li key={file.path}><code>{file.status.trim()}</code><span>{file.path}</span></li>)}</ul>
      {!review.files.length && <p className="translation-note">沒有新的檔案變更。</p>}
      {review.pendingCommits.length > 0 && <><h3>尚未推送的 commit · {review.pendingCommits.length}</h3><ul className="git-commits">{review.pendingCommits.map(item=><li key={item}>{item}</li>)}</ul></>}
      {review.excluded.length > 0 && <details><summary>未納入此次提交 · {review.excluded.length}</summary><ul className="git-commits">{review.excluded.map(file=><li key={file}>{file}</li>)}</ul></details>}
      {review.files.length > 0 && <label className="field git-message"><span>Commit 訊息（可修改）</span><input value={message} maxLength={200} disabled={busy || done} onChange={event=>setMessage(event.target.value)} /></label>}
    </>}
    {publishing && <div className="notice" role="status">正在檢查、建立 commit 並推送。請保留此視窗，可能需要一至兩分鐘。</div>}
    <div className="git-dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>void refresh(includeCode)}>{done && result?.status === 'push-failed' ? '重新檢視並重試' : '重新檢視變更'}</button><button type="button" className="primary" disabled={busy || done || !review?.canPublish || (!!review.files.length && !message.trim())} onClick={()=>void publish()}>{publishing ? '處理中…' : review?.files.length ? '確認提交並推送' : '確認推送現有 commit'}</button></div>
  </dialog>;
}
