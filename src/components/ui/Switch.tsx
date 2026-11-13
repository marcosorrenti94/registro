import * as RSwitch from '@radix-ui/react-switch';

export function Switch({
  id,
  checked,
  onCheckedChange,
  label,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-line-strong bg-surface-2 transition-colors data-[state=checked]:border-plum data-[state=checked]:bg-plum"
    >
      <RSwitch.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6" />
    </RSwitch.Root>
  );
}
