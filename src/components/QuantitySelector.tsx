import { Minus, Plus } from "lucide-react";
import "./QuantitySelector.css";

type QuantitySelectorProps = {
	quantity: number;
	onChange: (quantity: number) => void;
	label: string;
	decreaseLabel: string;
	increaseLabel: string;
	minimum?: number;
};

export default function QuantitySelector({
	quantity,
	onChange,
	label,
	decreaseLabel,
	increaseLabel,
	minimum = 1,
}: QuantitySelectorProps) {
	return (
		<div className="quantity-selector" role="group" aria-label={label}>
			<button
				className="quantity-selector__button"
				type="button"
				aria-label={decreaseLabel}
				disabled={quantity <= minimum}
				onClick={() => onChange(Math.max(minimum, quantity - 1))}
			>
				<Minus aria-hidden="true" />
			</button>
			<span className="quantity-selector__value" aria-live="polite">{quantity}</span>
			<button
				className="quantity-selector__button"
				type="button"
				aria-label={increaseLabel}
				onClick={() => onChange(quantity + 1)}
			>
				<Plus aria-hidden="true" />
			</button>
		</div>
	);
}
