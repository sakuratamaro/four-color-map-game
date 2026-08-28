import { Canvas, Line, Rect, vec } from '@shopify/react-native-skia';

interface Props {
  rows: number;
  columns: number;
  size: number;
}

export function BoardCanvas({ rows, columns, size }: Props) {
  const cellWidth = size / columns;
  const cellHeight = size / rows;
  const lines = [];

  for (let row = 0; row <= rows; row += 1) {
    const y = row * cellHeight;
    lines.push(<Line key={`r-${row}`} p1={vec(0, y)} p2={vec(size, y)} color="#888" strokeWidth={1} />);
  }
  for (let column = 0; column <= columns; column += 1) {
    const x = column * cellWidth;
    lines.push(<Line key={`c-${column}`} p1={vec(x, 0)} p2={vec(x, size)} color="#888" strokeWidth={1} />);
  }

  return (
    <Canvas style={{ width: size, height: size }}>
      <Rect x={0} y={0} width={size} height={size} color="#ffffff" />
      {lines}
    </Canvas>
  );
}
