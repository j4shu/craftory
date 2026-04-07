import { Routes, Route, NavLink } from "react-router-dom";
import Chat from "./pages/Chat";
import Inventory from "./pages/Inventory";

export default function App() {
  return (
    <>
      <header className="app-header">
        <h1>Craftory</h1>
        <nav>
          <NavLink to="/">Chat</NavLink>
          <NavLink to="/inventory">Inventory</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/inventory" element={<Inventory />} />
      </Routes>
    </>
  );
}
