import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loading } from "../components/ui";
import { money, num } from "../lib/format";
import { useApi, useDocumentTitle } from "../lib/hooks";
import { useT } from "../lib/i18n";
import { OFFICIAL } from "../lib/officialStats";
import type { PublicStats } from "../lib/types";

export const CHART = ["#1d5c43", "#d9a23a", "#255e9c", "#8a5530", "#6e3b8e", "#1f7a8c", "#9aa69f"];
const STATUS_COLOR: Record<string, string> = {
  "Qəbul edilib": "#255e9c", "Baxılır": "#d9a23a", "Əlavə məlumat tələb olunur": "#b4372a",
  "Qərar verilib: təsdiq": "#1d5c43", "Qərar verilib: imtina": "#9aa69f",
};
const toRows = (o: Record<string, number>) => Object.entries(o).map(([name, value]) => ({ name, value }));

export default function Transparency() {
  useDocumentTitle("Şəffaflıq");
  const { t } = useT();
  const { data: s } = useApi<PublicStats>("/api/v1/public/stats");
  if (!s) return <Loading />;

  const metrics = [
    [t("Təklif olunan sahələr"), num(s.plotCount), t("{ha} ha ümumi ərazi", { ha: num(s.totalAreaHa) })],
    [t("Minadan təmizlənmiş"), num(s.clearedPlots), t("{p}% sahələrin", { p: Math.round((s.clearedPlots / Math.max(1, s.plotCount)) * 100) })],
    [t("Daxil olan müraciətlər"), num(s.applicationCount), t("{n} üzrə qərar verilib", { n: num(s.decidedCount) })],
    [t("Planlaşdırılan investisiya"), money(s.plannedInvestment), t("{jobs} yeni iş yeri, {ret} qayıdan sakinlər üçün", { jobs: num(s.plannedJobs), ret: num(s.returneeJobs) })],
  ];

  return (
    <>
      <section className="band">
        <div className="wrap">
          <h1>{t("Açıq statistika")}</h1>
          <p>{t("Müsabiqələrin gedişi hər kəs üçün açıqdır. Şəxsi məlumatlar göstərilmir, rəqəmlər portalın məlumat bazasından canlı hesablanır.")}</p>
          <div className="ocds-box">
            <div>
              <b>{t("Açıq məlumat: Open Contracting Data Standard (OCDS 1.1)")}</b>
              <span>{t("Bütün elan edilmiş müsabiqələr, sahələr, iştirakçılar və qaliblər beynəlxalq standart formatda. Rəsmi OCDS JSON sxeminə uyğunluğu yoxlanılıb. Fiziki şəxslərin adları açıqlanmır.")}</span>
            </div>
            <div className="row">
              <a className="btn btn--sm" href="/api/v1/public/open-data/ocds?download=true">{t("JSON yüklə")}</a>
              <a className="btn btn--sm btn--ghost" href="https://standard.open-contracting.org/latest/en/" target="_blank" rel="noreferrer">{t("Standart haqqında")}</a>
            </div>
          </div>
        </div>
      </section>
      <div className="wrap page stack" style={{ ["--gap" as string]: "22px" }}>
        <OfficialResults t={t} />
        <h2 style={{ fontSize: 20, margin: "8px 0 0" }}>{t("Portaldakı müsabiqələr (canlı)")}</h2>
        <div className="grid grid--4">
          {metrics.map(([l, v, h]) => (
            <div key={l} className="panel metric"><div className="metric__label">{l}</div><div className="metric__value">{v}</div><div className="metric__hint">{h}</div></div>
          ))}
        </div>
        <div className="grid grid--2">
          <section className="panel">
            <div className="panel__head"><h3>{t("Müraciətlər statuslar üzrə")}</h3></div>
            <div className="panel__body" style={{ height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={toRows(s.applicationsByStatus)} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2} stroke="#fff">
                    {toRows(s.applicationsByStatus).map((r, i) => <Cell key={r.name} fill={STATUS_COLOR[r.name] ?? CHART[i % CHART.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, t(n)]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="panel__foot row" style={{ ["--gap" as string]: "14px", fontSize: 12.5 }}>
              {toRows(s.applicationsByStatus).map((r, i) => (
                <span key={r.name} className="row" style={{ ["--gap" as string]: "6px" }}><i style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLOR[r.name] ?? CHART[i] }} />{t(r.name)}: <b>{r.value}</b></span>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel__head"><h3>{t("Rayonlar üzrə planlaşdırılan investisiya")}</h3></div>
            <div className="panel__body" style={{ height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={toRows(s.investmentByDistrict)} margin={{ left: 10 }}>
                  <CartesianGrid vertical={false} stroke="#e5ebe7" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip formatter={(v: number) => money(v)} />
                  <Bar dataKey="value" name={t("İnvestisiya")} fill="#1d5c43" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel">
            <div className="panel__head"><h3>{t("Sahələr rayonlar üzrə")}</h3></div>
            <div className="panel__body" style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={toRows(s.byDistrict)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid horizontal={false} stroke="#e5ebe7" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={80} />
                  <Tooltip />
                  <Bar dataKey="value" name={t("Sahə")} fill="#d9a23a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="panel">
            <div className="panel__head"><h3>{t("Fəaliyyət istiqamətləri")}</h3></div>
            <div className="panel__body" style={{ height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={toRows(s.byActivity).map((r) => ({ ...r, name: t(r.name) }))} margin={{ left: 10 }}>
                  <CartesianGrid vertical={false} stroke="#e5ebe7" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" name={t("Sahə")} fill="#255e9c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/** The real competitions so far, from the Ministry's figures: what the portal is built to scale up. */
function OfficialResults({ t }: { t: ReturnType<typeof useT>["t"] }) {
  const leasedShare = Math.round((OFFICIAL.leasedHa / OFFICIAL.offeredHa) * 100);
  const cards = [
    [t("Təklif olunan torpaq"), `${num(OFFICIAL.offeredHa)} ha`, t("{n} rayonda", { n: OFFICIAL.districts })],
    [t("Müsabiqələr və iştirakçılar"), num(OFFICIAL.participants), t("{n} müsabiqədə iştirakçı", { n: OFFICIAL.competitions })],
    [t("Qaliblər"), num(OFFICIAL.winners), t("{n} icarə müqaviləsi imzalanıb (I–II müsabiqə)", { n: OFFICIAL.contracts })],
    [t("İcarəyə verilib"), `${num(OFFICIAL.leasedHa)} ha`, t("təklif olunanın {p}%-i", { p: leasedShare })],
  ];
  return (
    <section className="panel">
      <div className="panel__head"><h3>{t("Rəsmi nəticələr: azad olunmuş ərazilərdə keçirilmiş müsabiqələr")}</h3></div>
      <div className="panel__body stack" style={{ ["--gap" as string]: "18px" }}>
        <div className="grid grid--4">
          {cards.map(([l, v, h]) => (
            <div key={l} className="metric"><div className="metric__label">{l}</div><div className="metric__value">{v}</div><div className="metric__hint">{h}</div></div>
          ))}
        </div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={OFFICIAL.byDistrict} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid horizontal={false} stroke="#e5ebe7" />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => num(v)} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={80} />
              <Tooltip formatter={(v: number, n: string) => (n === t("İcarəyə verilən ərazi, ha") ? `${num(v)} ha` : money(v))} />
              <Bar dataKey="ha" name={t("İcarəyə verilən ərazi, ha")} fill="#1d5c43" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="hint" style={{ margin: 0 }}>{t("Mənbə:")} {t(OFFICIAL.source)}. {t("Ən böyük minimum investisiya öhdəliyi:")} Xocavənd ({money(80158892)}) {t("və")} Qubadlı ({money(69574110)}).</p>
      </div>
    </section>
  );
}
