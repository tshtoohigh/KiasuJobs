import { Briefcase, ListChecks, Plus, User } from "lucide-react";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell, type NavItem } from "@/components/layout/AppShell";
import { ToastHost } from "@/components/ToastHost";
import { Spinner } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth, useAuthStage } from "@/stores/useAuth";

import { Applicants } from "@/pages/Applicants";
import { Applications } from "@/pages/Applications";
import { Discover } from "@/pages/Discover";
import { EmployerProfile } from "@/pages/EmployerProfile";
import { Login } from "@/pages/Login";
import { NewJob } from "@/pages/NewJob";
import { OnboardEmployer } from "@/pages/OnboardEmployer";
import { OnboardSeeker } from "@/pages/OnboardSeeker";
import { Postings } from "@/pages/Postings";
import { RoleSelect } from "@/pages/RoleSelect";
import { SeekerProfile } from "@/pages/SeekerProfile";
import { SetupNotice } from "@/pages/SetupNotice";

const SEEKER_NAV: NavItem[] = [
  { to: "/", label: "Discover", icon: <Briefcase className="h-5 w-5" /> },
  {
    to: "/applications",
    label: "Applications",
    icon: <ListChecks className="h-5 w-5" />,
  },
  { to: "/profile", label: "Profile", icon: <User className="h-5 w-5" /> },
];

const EMPLOYER_NAV: NavItem[] = [
  { to: "/", label: "Postings", icon: <ListChecks className="h-5 w-5" /> },
  { to: "/new-job", label: "Post a job", icon: <Plus className="h-5 w-5" /> },
  { to: "/company", label: "Company", icon: <User className="h-5 w-5" /> },
];

/**
 * Every routing decision lives here.
 *
 * `useAuthStage` derives one of five stages from the session and profile row,
 * and each stage maps to exactly one set of routes. Pages never redirect on
 * auth state themselves.
 */
export function App() {
  const init = useAuth((state) => state.init);
  const role = useAuth((state) => state.appUser?.role ?? null);
  const stage = useAuthStage();

  useEffect(() => {
    // Returns an unsubscribe function for the auth listener.
    return init();
  }, [init]);

  // Nothing works until the Supabase keys are filled in, so say so plainly
  // rather than failing with a network error on every screen.
  if (!isSupabaseConfigured) return <SetupNotice />;

  if (stage === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <Spinner label="Starting KiasuJobs…" />
      </div>
    );
  }

  if (stage === "signed-out") {
    return (
      <>
        <Routes>
          <Route path="/*" element={<Login />} />
        </Routes>
        <ToastHost />
      </>
    );
  }

  if (stage === "needs-role") {
    return (
      <>
        <Routes>
          <Route path="/*" element={<RoleSelect />} />
        </Routes>
        <ToastHost />
      </>
    );
  }

  if (stage === "needs-onboarding") {
    return (
      <>
        <Routes>
          <Route
            path="/*"
            element={
              role === "employer" ? <OnboardEmployer /> : <OnboardSeeker />
            }
          />
        </Routes>
        <ToastHost />
      </>
    );
  }

  // stage === 'ready'
  return (
    <>
      {role === "employer" ? (
        <AppShell items={EMPLOYER_NAV}>
          <Routes>
            <Route path="/" element={<Postings />} />
            <Route path="/new-job" element={<NewJob />} />
            <Route path="/postings/:id" element={<Applicants />} />
            <Route path="/company" element={<EmployerProfile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      ) : (
        <AppShell items={SEEKER_NAV}>
          <Routes>
            <Route path="/" element={<Discover />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/profile" element={<SeekerProfile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      )}
      <ToastHost />
    </>
  );
}
