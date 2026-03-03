/**
 * Re-export of Ant Design's App.useApp() hook
 * 
 * Provides context-aware message, modal, and notification APIs that respect theme configuration.
 * Use this instead of static methods like message.success(), Modal.confirm(), etc.
 * 
 * @example
 * import { useAntdApp } from '@ten24group/ui24';
 * 
 * function MyComponent() {
 *   const { message, modal, notification } = useAntdApp();
 *   
 *   const handleSuccess = () => {
 *     message.success('Operation completed!');
 *   };
 *   
 *   const handleConfirm = () => {
 *     modal.confirm({
 *       title: 'Are you sure?',
 *       onOk: () => console.log('Confirmed')
 *     });
 *   };
 * }
 */
import { App } from 'antd';

export const useAntdApp = App.useApp;
