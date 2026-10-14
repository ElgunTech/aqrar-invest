# %% [markdown]
# # Qarabağ Aqrar İnvestisiya Portalı — Bitki tövsiyəsi modeli
#
# Bu notebook torpaq və iqlim göstəricilərinə görə **hansı bitkinin əkilməsinin daha uyğun olduğunu** proqnozlaşdıran modeli öyrədir.
#
# **Dataset:** [Crop Recommendation Dataset](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset) — 2200 nümunə, 22 bitki.
#
# | Sütun | Məna |
# |---|---|
# | `N`, `P`, `K` | Torpaqda azot, fosfor, kalium (kq/ha) |
# | `temperature` | Orta temperatur (°C) |
# | `humidity` | Nisbi rütubət (%) |
# | `ph` | Torpağın pH-ı |
# | `rainfall` | Yağıntı (mm) |
# | `label` | Uyğun bitki |
#
# **Nəticə:** `crop_model.onnx` + `model_meta.json`. Bu iki fayl Spring Boot portalına yerləşdirilir və model Java-da ONNX Runtime ilə işləyir (Python server lazım deyil).
#
# > ⚠️ Notebook-un sağ panelində **Settings → Internet → On** olmalıdır (skl2onnx qurmaq üçün).

# %%
!pip install -q skl2onnx onnxruntime

# %%
import glob, json, time, warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
from sklearn.inspection import permutation_importance

warnings.filterwarnings("ignore")
RANDOM_STATE = 42
FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET = "label"

# %% [markdown]
# ## 1. Məlumatın yüklənməsi

# %%
paths = glob.glob("/kaggle/input/**/Crop_recommendation.csv", recursive=True)
assert paths, "Crop_recommendation.csv tapılmadı. Sağ paneldə 'Add Input' ilə 'crop-recommendation-dataset' əlavə edin."
df = pd.read_csv(paths[0])
print(paths[0], df.shape)
df.head()

# %%
print("Boş dəyərlər:\n", df.isnull().sum())
print("\nTəkrarlanan sətirlər:", df.duplicated().sum())
print("\nBitki sayı:", df[TARGET].nunique())
df[TARGET].value_counts()

# %%
df[FEATURES].describe().T

# %% [markdown]
# ## 2. Kəşfiyyat xarakterli təhlil (EDA)

# %%
fig, axes = plt.subplots(2, 4, figsize=(18, 8))
for ax, col in zip(axes.flat, FEATURES):
    sns.histplot(df[col], kde=True, ax=ax, color="#2f7d4f")
    ax.set_title(col)
axes.flat[-1].axis("off")
plt.suptitle("Göstəricilərin paylanması", fontsize=14)
plt.tight_layout()
plt.show()

# %%
plt.figure(figsize=(8, 6))
sns.heatmap(df[FEATURES].corr(), annot=True, fmt=".2f", cmap="RdYlGn", center=0)
plt.title("Korrelyasiya matrisi")
plt.show()

# %%
fig, axes = plt.subplots(1, 3, figsize=(20, 6))
for ax, col in zip(axes, ["rainfall", "temperature", "K"]):
    order = df.groupby(TARGET)[col].median().sort_values().index
    sns.boxplot(data=df, x=TARGET, y=col, order=order, ax=ax, color="#9cc9a5")
    ax.tick_params(axis="x", rotation=90)
    ax.set_title(f"Bitkilərə görə {col}")
plt.tight_layout()
plt.show()

# %% [markdown]
# ## 3. Modellərin müqayisəsi (5-fold cross-validation)

# %%
X = df[FEATURES].astype(np.float32).values
y = df[TARGET].values
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
)

candidates = {
    "LogisticRegression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000)),
    "KNN": make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=5)),
    "DecisionTree": DecisionTreeClassifier(random_state=RANDOM_STATE),
    "RandomForest": RandomForestClassifier(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1),
    "ExtraTrees": ExtraTreesClassifier(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1),
    "GradientBoosting": GradientBoostingClassifier(n_estimators=100, random_state=RANDOM_STATE),
}

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
results = []
for name, model in candidates.items():
    t0 = time.time()
    scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="accuracy", n_jobs=-1)
    results.append({"model": name, "cv_mean": scores.mean(), "cv_std": scores.std(), "seconds": time.time() - t0})
    print(f"{name:20s} {scores.mean():.4f} ± {scores.std():.4f}")

results_df = pd.DataFrame(results).sort_values("cv_mean", ascending=False).reset_index(drop=True)
results_df

# %%
plt.figure(figsize=(9, 4))
sns.barplot(data=results_df, x="cv_mean", y="model", color="#2f7d4f")
plt.xlim(results_df.cv_mean.min() - 0.02, 1.0)
plt.title("Modellərin CV dəqiqliyi")
plt.show()

# %% [markdown]
# ## 4. Ən yaxşı modelin seçilməsi və test dəstində qiymətləndirilməsi
#
# Nəticələr yaxın olarsa (fərq < 0.5%), **RandomForest** üstün tutulur: həm sabitdir, həm də ehtimalları (probability) daha etibarlıdır.

# %%
best_name = results_df.iloc[0]["model"]
rf_score = results_df.set_index("model").loc["RandomForest", "cv_mean"]
if results_df.iloc[0]["cv_mean"] - rf_score < 0.005:
    best_name = "RandomForest"
print("Seçilmiş model:", best_name)

model = candidates[best_name]
model.fit(X_train, y_train)
y_pred = model.predict(X_test)

test_acc = accuracy_score(y_test, y_pred)
test_f1 = f1_score(y_test, y_pred, average="macro")
print(f"Test accuracy: {test_acc:.4f}   Macro F1: {test_f1:.4f}\n")
print(classification_report(y_test, y_pred))

# %%
classes = list(model.classes_)
cm = confusion_matrix(y_test, y_pred, labels=classes)
plt.figure(figsize=(12, 10))
sns.heatmap(cm, annot=True, fmt="d", cmap="Greens", xticklabels=classes, yticklabels=classes, cbar=False)
plt.xlabel("Proqnoz")
plt.ylabel("Həqiqi")
plt.title(f"Confusion matrix — {best_name}")
plt.show()

# %%
perm = permutation_importance(model, X_test, y_test, n_repeats=10, random_state=RANDOM_STATE, n_jobs=-1)
importance = pd.Series(perm.importances_mean, index=FEATURES).sort_values()
importance.plot.barh(figsize=(8, 4), color="#2f7d4f", title="Göstəricilərin əhəmiyyəti (permutation importance)")
plt.show()
importance.sort_values(ascending=False)

# %% [markdown]
# ## 5. ONNX formatına çevirmə
#
# `zipmap=False` — ehtimallar sadə `float[N, 22]` matrisi kimi qaytarılır, Java-da oxumaq asandır.

# %%
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import onnxruntime as ort

final_estimator = model.steps[-1][1] if hasattr(model, "steps") else model
onnx_model = convert_sklearn(
    model,
    initial_types=[("input", FloatTensorType([None, len(FEATURES)]))],
    options={type(final_estimator): {"zipmap": False}},
    target_opset=17,
)
with open("/kaggle/working/crop_model.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())

sess = ort.InferenceSession("/kaggle/working/crop_model.onnx", providers=["CPUExecutionProvider"])
print("Girişlər:", [(i.name, i.shape) for i in sess.get_inputs()])
print("Çıxışlar:", [(o.name, o.shape) for o in sess.get_outputs()])

# %%
# ONNX nəticələrinin sklearn ilə eyni olduğunu yoxlayırıq
onnx_label, onnx_proba = sess.run(None, {"input": X_test})
sk_proba = model.predict_proba(X_test)
print("Label uyğunluğu:", (np.asarray(onnx_label) == y_pred).mean())
print("Ehtimal fərqi (max):", np.abs(onnx_proba - sk_proba).max())

# %% [markdown]
# ## 6. Meta məlumatın saxlanması
#
# `model_meta.json` portal üçün lazımdır: sinif sırası, göstəricilərin adları, öyrənmə diapazonu (diapazondan kənar dəyərlər üçün xəbərdarlıq) və metriklər.

# %%
meta = {
    "model_name": best_name,
    "version": time.strftime("%Y.%m.%d-%H%M"),
    "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "dataset": "Kaggle: atharvaingle/crop-recommendation-dataset",
    "n_samples": int(len(df)),
    "features": FEATURES,
    "classes": classes,
    "input_name": "input",
    "probability_output": "probabilities",
    "feature_ranges": {c: {"min": float(df[c].min()), "max": float(df[c].max())} for c in FEATURES},
    "metrics": {
        "cv_accuracy": float(results_df.set_index("model").loc[best_name, "cv_mean"]),
        "test_accuracy": float(test_acc),
        "test_macro_f1": float(test_f1),
    },
    "feature_importance": {k: float(v) for k, v in importance.sort_values(ascending=False).items()},
    "model_comparison": {r["model"]: float(r["cv_mean"]) for r in results},
}
with open("/kaggle/working/model_meta.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)
print(json.dumps(meta["metrics"], indent=2))

# %% [markdown]
# ## 7. Nümunə: Qarabağ sahəsi üçün tövsiyə

# %%
samples = pd.DataFrame([
    {"sahə": "Ağcabədi — düzənlik", "N": 115, "P": 45, "K": 20, "temperature": 25, "humidity": 78, "ph": 7.0, "rainfall": 80},
    {"sahə": "Füzuli — dağətəyi",   "N": 25,  "P": 130, "K": 198, "temperature": 23, "humidity": 80, "ph": 6.2, "rainfall": 72},
    {"sahə": "Şuşa — dağlıq",       "N": 22,  "P": 132, "K": 200, "temperature": 21, "humidity": 90, "ph": 5.9, "rainfall": 115},
])
proba = sess.run(None, {"input": samples[FEATURES].astype(np.float32).values})[1]
for name, p in zip(samples["sahə"], proba):
    top = np.argsort(p)[::-1][:3]
    print(name, "→", ", ".join(f"{classes[i]} ({p[i]:.0%})" for i in top))

# %% [markdown]
# ## ✅ Növbəti addım
#
# Sağ paneldə **Output → /kaggle/working** bölməsindən bu iki faylı yükləyin:
# - `crop_model.onnx`
# - `model_meta.json`
#
# Onları portal layihəsində `backend/model/` qovluğuna qoyun və serveri yenidən başladın.
