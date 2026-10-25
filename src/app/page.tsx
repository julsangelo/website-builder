import Header from "@/components/header";
import MainContent from "@/components/main-content";
import Image from "next/image";

export default function Home() {
  return (
    <div className='flex h-screen flex-col'>
      <Header/>
      <MainContent/>
    </div>
  );
}
