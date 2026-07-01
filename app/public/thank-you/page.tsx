export default function ThankYouPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <div className="max-w-lg rounded-3xl bg-white p-10 text-center shadow-soft">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-3xl">✓</div>
        <h1 className="mt-6 text-3xl font-black">Thank you</h1>
        <p className="mt-3 text-slate-500">Your request has been received by Total Business Centres.</p>
      </div>
    </div>
  );
}
