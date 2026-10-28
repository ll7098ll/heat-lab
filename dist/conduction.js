// The renderer and solver share these positions and connections. Heat crosses
// connected material only; a nearby part across an empty gap is not a neighbor.
export const SOLID_SHAPES = {
  rod: { name: '직선 막대', icon: 'M3 10h18v4H3z', title: '막대의 한쪽 끝을 데워 볼까요?', hint: '데운 끝에서 반대쪽 끝까지 열이 차례로 전달돼요.', probes: ['A · 가까운 곳', 'B · 가운데', 'C · 먼 곳'] },
  elbow: { name: 'ㄱ자 막대', icon: 'M3 5h18v16h-4V9H3z', title: '꺾인 막대에서도 열이 전달될까요?', hint: '열은 빈 공간을 건너뛰지 않고, 이어진 막대를 따라 전달돼요.', probes: ['A · 가까운 곳', 'B · 꺾이기 전', 'C · 꺾인 뒤'] },
  ring: { name: '고리', icon: 'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', title: '고리를 데우면 어느 쪽으로 퍼질까요?', hint: '데운 곳에서 양쪽으로 퍼져요. 같은 거리의 A와 B를 비교해 보세요.', probes: ['A · 한쪽 길', 'B · 다른 쪽 길', 'C · 맞은편'] },
  plate: { name: '넓은 판', icon: 'M3 5h18v14H3zM3 10h18M8 5v14M15 5v14', title: '넓은 판에서는 열이 어떻게 퍼질까요?', hint: '열이 판의 가로와 세로로 퍼져요. A 옆의 B와 더 먼 C도 살펴보세요.', probes: ['A · 열원 가까이', 'B · A의 옆쪽', 'C · 판 가운데'] },
};
export const PLATE_WIDTH = 25, PLATE_HEIGHT = 17, PLATE_SIZE = { width: 5.7, height: 3.8 };
export function solidPosition(shape, u) {
  if (shape === 'ring') return { x: -1.72 * Math.cos(u * Math.PI * 2), y: 1.28, z: 1.72 * Math.sin(u * Math.PI * 2) };
  if (shape === 'elbow') {
    const distance = u * 5.7, corner = .35 * Math.PI / 2;
    if (distance <= 3.2) return { x: -2.2 + distance, y: 1.28, z: 1 };
    if (distance < 3.2 + corner) { const a = (distance - 3.2) / .35; return { x: 1 + .35 * Math.sin(a), y: 1.28, z: .65 + .35 * Math.cos(a) }; }
    return { x: 1.35, y: 1.28, z: .65 - (distance - 3.2 - corner) };
  }
  return { x: -2.85 + u * 5.7, y: 1.28, z: 0 };
}
export function createConductionGraph(shape = 'rod') {
  const plate = shape === 'plate', closed = shape === 'ring';
  const count = plate ? PLATE_WIDTH * PLATE_HEIGHT : closed ? 40 : 22;
  const positions = Array.from({ length: count }, (_, i) => plate
    ? { x: (i % PLATE_WIDTH) / (PLATE_WIDTH - 1) * 5.7 - 2.85, y: 1.28, z: Math.floor(i / PLATE_WIDTH) / (PLATE_HEIGHT - 1) * 3.8 - 1.9 }
    : solidPosition(shape, i / (closed ? count : count - 1)));
  const neighbors = Array.from({ length: count }, () => []);
  const spacing = plate ? 5.7 / (PLATE_WIDTH - 1) : closed ? 2 * Math.PI * 1.72 / count : 5.7 / 21;
  const weight = (5.7 / 21 / spacing) ** 2;
  function connect(a, b) { neighbors[a].push(b); neighbors[b].push(a); }
  if (plate) {
    for (let row = 0; row < PLATE_HEIGHT; row++) for (let col = 0; col < PLATE_WIDTH; col++) {
      const i = row * PLATE_WIDTH + col;
      if (col + 1 < PLATE_WIDTH) connect(i, i + 1);
      if (row + 1 < PLATE_HEIGHT) connect(i, i + PLATE_WIDTH);
    }
  } else { for (let i = 0; i < count - 1; i++) connect(i, i + 1); if (closed) connect(count - 1, 0); }
  return { shape, closed, positions, neighbors, weight, source: plate ? 8 * PLATE_WIDTH : 0,
    probes: plate ? [8 * PLATE_WIDTH + 3, 12 * PLATE_WIDTH + 3, 8 * PLATE_WIDTH + 12] : closed ? [6, 34, 20] : [2, 10, 19] };
}
export class PlateTemperatureField {
  constructor() { this.width = PLATE_WIDTH; this.height = PLATE_HEIGHT; this.data = new Uint8Array(PLATE_WIDTH * PLATE_HEIGHT * 4); this.version = 0; }
  update(temperatures) {
    temperatures.forEach((t, i) => { const v = Math.round(Math.max(0, Math.min(1, (t - 20) / 80)) * 65535); this.data[i * 4] = v >> 8; this.data[i * 4 + 1] = v & 255; this.data[i * 4 + 3] = 255; });
    this.version++;
  }
}
