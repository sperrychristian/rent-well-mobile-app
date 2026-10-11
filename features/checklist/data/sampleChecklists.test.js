import { sample_checklists } from './sampleChecklists';
import { checklistProgress, worseCount } from '../utils/checklistHelpers';

// the demo needs one signed checklist and one in progress, with the worse flags showing
describe('sample_checklists', () => {
  test('one complete move-in and one in progress move-out made from it', () => {
    const [move_in, move_out] = sample_checklists;
    expect(move_in.type).toBe('Move-In');
    expect(move_in.completed).toBe(true);
    expect(move_out.type).toBe('Move-Out');
    expect(move_out.completed).toBe(false);
    expect(move_out.move_in_id).toBe(move_in.id);
  });

  test('the move-in is all done and the move-out is part way', () => {
    const move_in_progress = checklistProgress(sample_checklists[0]);
    const move_out_progress = checklistProgress(sample_checklists[1]);
    expect(move_in_progress.done).toBe(move_in_progress.total);
    expect(move_out_progress.done).toBeGreaterThan(0);
    expect(move_out_progress.done).toBeLessThan(move_out_progress.total);
  });

  test('the move-out has items that got worse and every id is unique', () => {
    expect(worseCount(sample_checklists[1])).toBe(2);
    const ids = [];
    sample_checklists.forEach((checklist) => {
      ids.push(checklist.id);
      checklist.rooms.forEach((room) => {
        ids.push(room.id);
        room.items.forEach((item) => ids.push(item.id));
      });
    });
    expect(new Set(ids).size).toBe(ids.length);
  });
});
