import { AnimatePresence, motion } from "framer-motion";
import { useSimStore } from "@/store/useSimStore";
import { MissionPicker } from "@/components/dashboard/MissionPicker";
import { Workspace } from "@/components/dashboard/Workspace";

function App() {
  const missionId = useSimStore((s) => s.missionId);

  return (
    <div className="bg-background text-foreground">
      <AnimatePresence mode="wait">
        {missionId ? (
          <motion.div
            key="workspace"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <Workspace />
          </motion.div>
        ) : (
          <motion.div
            key="picker"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <MissionPicker />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
