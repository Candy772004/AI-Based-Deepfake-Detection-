import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import TextAnalysis from "./pages/TextAnalysis";
import VisionAnalysis from "./pages/VisionAnalysis";
import VideoAnalysis from "./pages/VideoAnalysis";
import AudioAnalysis from "./pages/AudioAnalysis";
import AutonomousAssistant from "./pages/AutonomousAssistant";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="text" element={<TextAnalysis />} />
          <Route path="vision" element={<VisionAnalysis />} />
          <Route path="video" element={<VideoAnalysis />} />
          <Route path="audio" element={<AudioAnalysis />} />
          <Route path="assistant" element={<AutonomousAssistant />} />
        </Route>
      </Routes>
    </Router>
  );
}
