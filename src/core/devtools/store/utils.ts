export { IS_DEV, IS_PROD } from '../../constants';

let _idCounter = 0;

export function generateId(): string {
  return `dt_${++_idCounter}_${Date.now().toString(36)}`;
}
