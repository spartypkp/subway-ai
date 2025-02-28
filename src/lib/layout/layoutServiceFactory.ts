import SlotBasedLayoutService from './slotBasedLayoutService';
import TreeBasedLayoutService from './treeBasedLayoutService';

export type LayoutServiceType = 'slot' | 'tree';

/**
 * Factory for creating layout services
 */
export class LayoutServiceFactory {
  /**
   * Get a layout service instance based on the specified type
   */
  static getLayoutService(type: LayoutServiceType = 'tree') {
    switch (type) {
      case 'slot':
        return new SlotBasedLayoutService();
      case 'tree':
        return new TreeBasedLayoutService();
      default:
        return new TreeBasedLayoutService();
    }
  }
}

export default LayoutServiceFactory; 