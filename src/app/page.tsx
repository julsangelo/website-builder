import Header from "@/components/header";
import MainContent from "@/components/main-content";

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <MainContent />
    </div>
  );
}
