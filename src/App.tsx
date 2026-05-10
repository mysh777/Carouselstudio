import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import Auth from './components/Auth';
import Sidebar, { View } from './components/Sidebar';
import Projects from './pages/Projects';
import BrandKits from './pages/BrandKits';
import Presets from './pages/Presets';
import ProjectEditor from './pages/ProjectEditor';
import Toaster from './components/Toaster';

export default function App() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>('projects');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Auth />
        <Toaster />
      </>
    );
  }

  return (
    <>
      {openProjectId ? (
        <div className="h-screen">
          <ProjectEditor
            projectId={openProjectId}
            onBack={() => setOpenProjectId(null)}
          />
        </div>
      ) : (
        <div className="h-screen flex bg-slate-50">
          <Sidebar view={view} setView={setView} user={user} />
          <main className="flex-1 overflow-hidden">
            {view === 'projects' && <Projects onOpen={(id) => setOpenProjectId(id)} />}
            {view === 'brands' && <BrandKits />}
            {view === 'presets' && <Presets />}
          </main>
        </div>
      )}
      <Toaster />
    </>
  );
}
