import { useDocumentTitle } from "../lib/hooks";
import credits from "../credits.json";

export default function About() {
  useDocumentTitle("Foto mənbələri");
  return (
    <>
      <section className="band">
        <div className="wrap">
          <h1>Foto mənbələri və lisenziyalar</h1>
          <p>Giriş səhifəsində istifadə olunan bütün fotolar Wikimedia Commons-dan açıq lisenziya ilə götürülüb. Müəlliflərə təşəkkür edirik.</p>
        </div>
      </section>
      <div className="wrap page">
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
