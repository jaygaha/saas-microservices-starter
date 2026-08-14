import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Teams } from './pages/Teams'
import { TeamDetail } from './pages/TeamDetail'

function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			<Route path="/register" element={<Register />} />
			<Route
				path="/teams"
				element={
					<ProtectedRoute>
						<Layout><Teams /></Layout>
					</ProtectedRoute>
				}
			/>
			<Route
				path="/teams/:id"
				element={
					<ProtectedRoute>
						<Layout><TeamDetail /></Layout>
					</ProtectedRoute>
				}
			/>
			<Route path="/" element={<Navigate to="/teams" replace />} />
			<Route path="*" element={<Navigate to="/teams" replace />} />
		</Routes>
	)
}

export default App


