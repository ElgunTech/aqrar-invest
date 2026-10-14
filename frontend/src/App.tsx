import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Loading } from "./components/ui";
import { useAuth } from "./lib/auth";
import type { User } from "./lib/types";

const Landing = lazy(() => import("./pages/Landing"));
const Home = lazy(() => import("./pages/Home"));
const MapPage = lazy(() => import("./pages/MapPage"));
const Map3D = lazy(() => import("./pages/Map3D"));
const Catalog = lazy(() => import("./pages/Catalog"));
const PlotDetail = lazy(() => import("./pages/PlotDetail"));
const Compare = lazy(() => import("./pages/Compare"));
const Competitions = lazy(() => import("./pages/Competitions"));
const Advisor = lazy(() => import("./pages/Advisor"));
const Transparency = lazy(() => import("./pages/Transparency"));
const Login = lazy(() => import("./pages/Login"));
const Apply = lazy(() => import("./pages/Apply"));
const Cabinet = lazy(() => import("./pages/Cabinet"));
const Admin = lazy(() => import("./pages/Admin"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyGovDemo = lazy(() => import("./pages/MyGovDemo"));
const MyGovCallback = lazy(() => import("./pages/MyGovCallback"));
const Receipt = lazy(() => import("./pages/Receipt"));
const Verify = lazy(() => import("./pages/Verify"));

/** Route guard: unauthenticated → login (with return path); wrong role → home. */
function RequireUser({ roles, children }: { roles?: User["role"][]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/giris?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === "INVESTOR" ? "/kabinet" : "/admin"} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="mygov-demo" element={<MyGovDemo />} />
        <Route path="kabinet/:id/qebz" element={<RequireUser roles={["INVESTOR"]}><Receipt /></RequireUser>} />
        <Route element={<Layout />}>
          <Route path="portal" element={<Home />} />
          <Route path="xerite" element={<MapPage />} />
          <Route path="xerite-3d" element={<Map3D />} />
          <Route path="kataloq" element={<Catalog />} />
          <Route path="sahe/:id" element={<PlotDetail />} />
          <Route path="muqayise" element={<Compare />} />
          <Route path="musabiqeler" element={<Competitions />} />
          <Route path="ai" element={<Advisor />} />
          <Route path="seffafliq" element={<Transparency />} />
          <Route path="haqqinda" element={<About />} />
          <Route path="yoxla" element={<Verify />} />
          <Route path="yoxla/:number" element={<Verify />} />
          <Route path="giris" element={<Login />} />
          <Route path="mygov/callback" element={<MyGovCallback />} />
          <Route path="muraciet" element={<RequireUser roles={["INVESTOR"]}><Apply /></RequireUser>} />
          <Route path="kabinet" element={<RequireUser roles={["INVESTOR"]}><Cabinet /></RequireUser>} />
          <Route path="kabinet/:id" element={<RequireUser roles={["INVESTOR"]}><Cabinet /></RequireUser>} />
          <Route path="admin" element={<RequireUser roles={["ADMIN", "EVALUATOR"]}><Admin /></RequireUser>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
