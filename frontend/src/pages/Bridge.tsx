import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Bridge functionality is now integrated into the Swap page
// This component redirects to the swap page with bridge tab active
export default function Bridge() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to swap page - bridge is now a tab in the unified swap/bridge interface
    navigate('/swap?tab=bridge', { replace: true });
  }, [navigate]);

  return null;
}
