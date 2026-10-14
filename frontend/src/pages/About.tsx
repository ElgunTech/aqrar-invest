import { useApi, useDocumentTitle } from "../lib/hooks";
import { dateTime } from "../lib/format";

interface Source { key: string; title: string; publisher: string; dataset: string; license: string; rows: number; fetchedAt: string; filter?: string }
import credits from "../credits.json";

export default function About() {
  useDocumentTitle("Məlumat mənbələri");
  const { data } = useApi<{ datasets: Source[]; statisticsFrom: string; statisticsRefreshedAt: string | null }>("/api/v1/public/official/sources");
  return (
    <>
      <section className="band">
        <div className="wrap">
          <h1>Məlumat mənbələri və lisenziyalar</h1>
          <p>Portal rəsmi açıq məlumatlardan istifadə edir: ANAMA-nın minadan təmizlənmiş sahələri və Dövlət Statistika Komitəsinin rayonlar üzrə göstəriciləri (opendata.az). Fotolar Wikimedia Commons-dandır.</p>
        </div>
      </section>
      <div className="wrap page">
        <h2 style={{ marginBottom: 12 }}>Rəsmi açıq məlumatlar</h2>
        <div className="panel table-wrap" style={{ marginBottom: 32 }}>
          <table className="table">
            <thead><tr><th>Məlumat dəsti</th><th>Dərc edən</th><th>Lisenziya</th><th className="num">Sətir</th><th>Yüklənib</th></tr></thead>
            <tbody>
              {data?.datasets.map((s) => (
                <tr key={s.key}>
                  <td><a href={s.dataset} target="_blank" rel="noreferrer">{s.title}</a>{s.filter && <div className="faint" style={{ fontSize: 12 }}>{s.filter}</div>}</td>
                  <td>{s.publisher}</td>
                  <td>{s.license}</td>
                  <td className="num">{s.rows}</td>
                  <td>{dateTime(s.fetchedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && <p className="faint" style={{ fontSize: 13, margin: "-20px 0 32px" }}>Statistikanın vəziyyəti: {data.statisticsFrom}{data.statisticsRefreshedAt ? `, ${dateTime(data.statisticsRefreshedAt)}` : ""}. Yeniləmə: tools/opendata/fetch.mjs və ya inzibati panel.</p>}
        <h2 style={{ marginBottom: 12 }}>Fotolar</h2>
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr><th>Səhnə</th><th>Fayl</th><th>Müəllif</th><th>Lisenziya</th></tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c.file}>
                  <td>{c.scene}</td>
                  <td><a href={c.source} target="_blank" rel="noreferrer">{c.title.replace("File:", "")}</a></td>
                  <td>{c.artist}</td>
                  <td><a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Fotolar kəsilib və ölçüləri dəyişdirilib. CC BY-SA lisenziyalı əsərlərin dəyişdirilmiş variantları eyni lisenziya ilə paylaşılır.
        </p>
      </div>
    </>
  );
}
