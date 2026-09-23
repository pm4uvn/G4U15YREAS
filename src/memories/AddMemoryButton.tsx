interface AddMemoryButtonProps {
  onClick: () => void
  label?: string
}

export function AddMemoryButton({ onClick, label = '+ Thêm kỷ niệm' }: AddMemoryButtonProps) {
  return (
    <button type="button" className="memory-cta" onClick={onClick}>
      {label}
    </button>
  )
}
