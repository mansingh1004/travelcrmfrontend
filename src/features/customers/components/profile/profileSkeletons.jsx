import { FONT } from "./profileUi";

/**
 * First paint, shaped like the page it precedes.
 *
 * The heights here are the real ones — 56px band, 44px facts row, 76px money row, 56px tabs — so
 * nothing jumps under the cursor when the summary lands. The previous skeleton still described the
 * old dark hero and four tiles, which meant every load ended in a visible reflow: a skeleton that
 * doesn't match its page is just a differently-shaped flash.
 */
export function LoadingPage() {
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: FONT }}>
      <div className="border-b border-slate-200 bg-white/80 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] animate-pulse items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-200" />
          <div className="h-10 w-10 rounded-xl bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-slate-200" />
            <div className="h-4 w-48 rounded bg-slate-200" />
          </div>
          <div className="ml-auto flex gap-2">
            {[0, 1, 2].map((item) => <div key={item} className="h-10 w-10 rounded-xl bg-slate-200" />)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] animate-pulse space-y-4 px-4 py-4 sm:px-6">
        <div className="h-11 rounded-2xl bg-white" />
        <div className="h-[76px] rounded-2xl bg-white" />
        <div className="h-14 rounded-2xl bg-white" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-80 rounded-2xl bg-white lg:col-span-2" />
          <div className="h-80 rounded-2xl bg-white" />
        </div>
      </div>
    </div>
  );
}

/** Overview's two-column shape, for the gap between the band painting and getById landing. */
export function LoadingBlock() {
  return (
    <div className="grid animate-pulse items-start gap-5 lg:grid-cols-3">
      <div className="h-96 rounded-2xl bg-white lg:col-span-2" />
      <div className="h-80 rounded-2xl bg-white" />
    </div>
  );
}
