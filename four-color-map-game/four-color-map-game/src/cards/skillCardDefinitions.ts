export type SkillPhase = 'COLOR' | 'WORK';

export interface SkillCardDefinition {
  id: string;
  nameJa: string;
  nameEn: string;
  category: string;
  allowedPhase: SkillPhase;
  descriptionJa: string;
  prototypeRarity: 1 | 2 | 3 | 4 | 5;
  balanceStatus: 'PROVISIONAL';
}

// Rarities below exist only to exercise UI/gacha code. They are NOT approved balance.
export const SKILL_CARD_DEFINITIONS: SkillCardDefinition[] = [
  {
    id: 'area-expansion', nameJa: 'エリア拡張', nameEn: 'Area Expansion', category: 'Construction', allowedPhase: 'WORK',
    descriptionJa: '次回の新規エリアで指定可能な最大セル数を増やす。', prototypeRarity: 1, balanceStatus: 'PROVISIONAL',
  },
  {
    id: 'palette-change', nameJa: '持ち色変更', nameEn: 'Palette Change', category: 'Color', allowedPhase: 'COLOR',
    descriptionJa: '現在の持ち色の一部を変更する。変更後の色は相手に非公開。', prototypeRarity: 2, balanceStatus: 'PROVISIONAL',
  },
  {
    id: 'region-recolor', nameJa: '既塗エリア色変更', nameEn: 'Region Recolor', category: 'Color/Map', allowedPhase: 'COLOR',
    descriptionJa: '既に彩色されたエリア1つの色を変更する。詰み回避にも使用可能。', prototypeRarity: 3, balanceStatus: 'PROVISIONAL',
  },
  {
    id: 'region-split', nameJa: 'エリア二分', nameEn: 'Region Split', category: 'Counter', allowedPhase: 'COLOR',
    descriptionJa: '受け取った未彩色エリアを二分し、一方を塗って残りを相手へ返す。', prototypeRarity: 4, balanceStatus: 'PROVISIONAL',
  },
  {
    id: 'grid-shift', nameJa: '0.5マスシフト', nameEn: 'Half-cell Grid Shift', category: 'Geometry', allowedPhase: 'WORK',
    descriptionJa: '行または列を0.5マスずらす。最初の使用で試合中のシフト軸が固定される。', prototypeRarity: 4, balanceStatus: 'PROVISIONAL',
  },
  {
    id: 'playable-area-expansion', nameJa: '領域拡大', nameEn: 'Playable Area Expansion', category: 'Space', allowedPhase: 'WORK',
    descriptionJa: '新規エリア指定可能な未使用セル範囲を拡大する。', prototypeRarity: 2, balanceStatus: 'PROVISIONAL',
  },
  {
    id: 'playable-area-reduction', nameJa: '領域縮小', nameEn: 'Playable Area Reduction', category: 'Space', allowedPhase: 'WORK',
    descriptionJa: '未使用セルを新規エリア指定不可にする。既存エリアは削除しない。', prototypeRarity: 2, balanceStatus: 'PROVISIONAL',
  },
  {
    id: 'corner-expansion', nameJa: '角膨張', nameEn: 'Corner Expansion', category: 'Geometry', allowedPhase: 'WORK',
    descriptionJa: '指定セルの四隅を膨らませ、斜め方向との接触を発生させる。', prototypeRarity: 3, balanceStatus: 'PROVISIONAL',
  },
];
