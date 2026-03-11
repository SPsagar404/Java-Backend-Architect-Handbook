# Part 15: Production Architecture

## 15.1 Scaling React Applications

When building enterprise applications, the simple "components" and "pages" folders are no longer enough. You must think about how state flows, how APIs are integrated, how styles are handled, and how features are decoupled.

A production architecture should enforce:
- **Separation of Concerns:** UI does not mix with API calls or business logic.
- **Modularity:** Features can be easily added, modified, or removed.
- **Predictability:** Developers know exactly where to put new code.

---

## 15.2 Feature-Sliced Design (Production Standard)

The modern standard for large React applications is **Feature-Sliced Design**. Instead of grouping by file type (all hooks together, all components together), you group files by **Feature Area**.

### Folder Structure

```
src/
|-- app/                    # Application setup (entry point, global providers)
|   |-- store.ts            # Global Redux store
|   |-- router.tsx          # Main React Router setup
|   +-- App.tsx             # Root component
|
|-- shared/                 # Truly generic, agnostic utilities & UI
|   |-- ui/                 # Buttons, Modals, Inputs (no business logic)
|   |-- api/                # Axios instance configuration
|   |-- utils/              # Generic formatters, regex constants
|   +-- hooks/              # useDebounce, useLocalStorage
|
|-- entities/               # Business entities (domain logic)
|   |-- User/
|   |   |-- User.types.ts   # User interfaces
|   |   |-- User.api.ts     # fetchUser endpoints
|   |   +-- UserAvatar.tsx  # Display component for user
|   +-- Product/
|
|-- features/               # User interactions combining entities
|   |-- AuthUser/           # Login/Logout functionality
|   |   |-- api/
|   |   |-- model/          # Redux slice or Zustand store for Auth
|   |   +-- ui/             # LoginForm.tsx, LogoutButton.tsx
|   +-- AddToCart/
|
|-- widgets/                # Composition of features into independent blocks
|   |-- Header/             # Contains Title + AuthUser profile
|   +-- Sidebar/
|
|-- pages/                  # Route components composing widgets
|   |-- DashboardPage/
|   +-- LoginPage/
```

### Why this is powerful:
If you need to delete the "AddToCart" functionality, you delete the `features/AddToCart` folder. You do not have to hunt for its components, its Redux actions, and its API calls across 5 different overarching folders.

---

## 15.3 Architecture Diagrams

### Component Hierarchy (Atomic Design Principles)

Modern production React UI builds outwards from the smallest pieces.

```
+--------------------------------------------------------------+
|                    UI COMPONENT HIERARCHY                     |
+--------------------------------------------------------------+
|                                                              |
|  ATOMS (Shared UI)                                           |
|  <Button /> | <Input /> | <Typography /> | <Icon />          |
|      No business logic, purely presentational.               |
|                                                              |
|        ^                                                     |
|        |                                                     |
|  MOLECULES (Combined Atoms)                                  |
|  <SearchBox /> (Input + Icon + Button)                       |
|  <FormField /> (Label + Input + ErrorText)                   |
|                                                              |
|        ^                                                     |
|        |                                                     |
|  ORGANISMS (Widgets - State Aware)                           |
|  <TopNavbar /> | <ProductCard /> | <LoginForm />             |
|  Connects to Redux/Context. Handles local logic.             |
|                                                              |
|        ^                                                     |
|        |                                                     |
|  TEMPLATES (Layouts)                                         |
|  <DashboardLayout />                                         |
|  Defines the grid/flexboxes where content will go.           |
|                                                              |
|        ^                                                     |
|        |                                                     |
|  PAGES (Routes)                                              |
|  <UserProfilePage />                                         |
|  Fetches data (React Query), passes to Templates/Organisms   |
+--------------------------------------------------------------+
```

### State Management Flow

Production applications do not use just one state manager. They split state by its purpose.

```
+--------------------------------------------------------------+
|                    STATE CLASSIFICATION                       |
+--------------------------------------------------------------+
|                                                              |
|  1. SERVER STATE (Data from API)                             |
|     Tool: React Query / RTK Query / SWR                      |
|     Responsibility: Caching, loading/error states, retries,  |
|                     background fetching.                     |
|                                                              |
|  2. GLOBAL APP STATE (Client-side only)                      |
|     Tool: Zustand / Redux / Context (Theme)                  |
|     Responsibility: User session, UI Theme, Auth Token,      |
|                     Sidebar collapse state.                  |
|                                                              |
|  3. URL STATE (Sharable state)                               |
|     Tool: React Router (useSearchParams)                     |
|     Responsibility: Search queries, pagination, active tab,  |
|                     sorting filters.                         |
|                                                              |
|  4. LOCAL COMPONENT STATE                                    |
|     Tool: useState / useReducer / React Hook Form            |
|     Responsibility: Form inputs, modal open/close, toggles.  |
+--------------------------------------------------------------+
```

### API Integration Layer

The API layer must be abstracted away from the UI components. A component should never know *how* `fetch` or `axios` works. A component should only call a function or a React Query hook.

```
+--------------------------------------------------------------+
|                 API ABSTRACTION LAYER                         |
+--------------------------------------------------------------+
|                                                              |
|  [ COMPONENT LAYER ]                                         |
|  <ProductListPage />                                         |
|          |                                                   |
|          | calls useQuery(getProducts)                       |
|          v                                                   |
|                                                              |
|  [ DATA FETCHER LAYER ] (React Query)                        |
|  useProductsHook.ts                                          |
|  Handles loading state, caches the return value.             |
|          |                                                   |
|          | calls service                                     |
|          v                                                   |
|                                                              |
|  [ SERVICE LAYER ]                                           |
|  productService.ts                                           |
|  const getProducts = () => axiosInstance.get('/products')    |
|          |                                                   |
|          | uses HTTP Client                                  |
|          v                                                   |
|                                                              |
|  [ HTTP CLIENT LAYER ]                                       |
|  axiosConfig.ts                                              |
|  Intercepts requests, appends Bearer tokens.                 |
|  Intercepts responses, handles 401 unauth errors globally.   |
|          |                                                   |
|          v                                                   |
|  [ BACKEND API SERVER ]                                      |
+--------------------------------------------------------------+
```

---

## 15.4 Environment Configuration

Production apps require management of variables across `development`, `staging`, and `production`.

In React (e.g., using Vite or Create React App), environment variables are strictly separated.

**`.env.development`**
```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_ENABLE_MOCKING=true
VITE_ENVIRONMENT=dev
```

**`.env.production`**
```env
VITE_API_BASE_URL=https://api.myenterpriseapp.com/v1
VITE_ENABLE_MOCKING=false
VITE_ENVIRONMENT=prod
```

**Usage:**
```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL // Vite syntax
  // OR: process.env.REACT_APP_API_BASE_URL // CRA syntax
});
```

---

## 15.5 Error Monitoring & Boundaries

A crash in a JavaScript application results in a "White Screen of Death". Production applications use Error Boundaries and monitoring tools (like Sentry).

**Global Error Boundary:**
Catches UI rendering errors.
```tsx
import { ErrorBoundary } from 'react-error-boundary';

function FallbackUI({ error, resetErrorBoundary }) {
  return (
    <div className="error-container">
      <h1>Something went wrong.</h1>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

// In App.tsx
function App() {
  return (
    <ErrorBoundary 
      FallbackComponent={FallbackUI}
      onError={(error) => {
        // Log to external service like Sentry or Datadog
        Sentry.captureException(error);
      }}
    >
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
```

By following Feature-Sliced Design, strict state separation, and implementing API abstraction and boundaries, React applications scale smoothly across dozens of developers and millions of users.
