export default function Chat({ text, role }: { text: string; role: string }) {
  return (
    <>
      {role == "human" ? (
        <div className="border-2 p-2 bg-slate-400 text-xs ml-auto max-w-72 rounded-lg">
          {text}
        </div>
      ) : role == "ai" ? (
        <div className="border-2 p-2 bg-[#cc3300] text-xs mr-auto max-w-72 rounded-lg text-white">
          {text}
        </div>
      ) : (
        <></>
      )}
    </>
  );
}
