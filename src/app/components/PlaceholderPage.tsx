type PlaceholderPageProps = {
  title: string;
  description?: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-black">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm text-black/70">{description}</p>
      ) : null}
      <div className="mt-10 rounded-lg border border-dashed border-black/20 bg-white p-12 text-center text-sm text-black/60">
        This section is coming soon.
      </div>
    </div>
  );
}
