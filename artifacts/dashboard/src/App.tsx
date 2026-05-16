import { AppProvider } from '@/context/AppContext';
import HomePage from '@/pages/Home';
import PasswordGate from '@/components/PasswordGate';

export default function App() {
  return (
    <PasswordGate>
      <AppProvider>
        <HomePage />
      </AppProvider>
    </PasswordGate>
  );
}
