export enum EditMode {
  Single = 'single',
  Line = 'line',
  Floor = 'floor',
  Wall = 'wall',
}

export const EditModeLabels: Record<EditMode, string> = {
  [EditMode.Single]: 'Single',
  [EditMode.Line]: 'Line',
  [EditMode.Floor]: 'Floor',
  [EditMode.Wall]: 'Wall',
}

export const EditModeShortcuts: Record<string, EditMode> = {
  '1': EditMode.Single,
  '2': EditMode.Line,
  '3': EditMode.Floor,
  '4': EditMode.Wall,
}

