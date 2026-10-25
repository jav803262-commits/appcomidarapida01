interface Category {
  id: string;
  label: string;
}

interface Props {
  categories: Category[];
  selected: string;
  onChange: (category: string) => void;
}

export function CategoryFilter({ categories, selected, onChange }: Props) {
  return (
    <div className="sticky top-16 z-30 -mx-4 overflow-x-auto border-b border-zinc-200 bg-stone-50 px-4 py-3">
      <div className="flex min-w-max gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => onChange(category.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              selected === category.id
                ? "bg-red-600 text-white"
                : "bg-white text-zinc-700 ring-1 ring-zinc-200"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}
