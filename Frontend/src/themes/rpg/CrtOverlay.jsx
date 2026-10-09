import { createPortal } from 'react-dom';
export default function CrtOverlay() {
 return createPortal(<div className="dos-crt-overlay" aria-hidden="true"><i /></div>,document.body);
}
