import { AppProvider } from '@/context/AppContext';
import HomePage from '@/pages/Home';

export default function App() {
  return (
    <AppProvider>
      <HomePage />
    </AppProvider>
  );
}
