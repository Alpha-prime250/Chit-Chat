import { getAvatarColor, getInitial } from "../utils/avatar";

const SIZES = {
  sm: 26,
  md: 32,
  lg: 44,
};

export default function Avatar({ name, size = "md" }) {
  const dimension = SIZES[size] || SIZES.md;
  const fontSize = Math.round(dimension * 0.42);

  return (
    <span
      className="avatar-circle"
      style={{
        width: dimension,
        height: dimension,
        fontSize,
        backgroundColor: getAvatarColor(name),
      }}
      title={name}
    >
      {getInitial(name)}
    </span>
  );
}