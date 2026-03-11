# Part 11: Performance Optimization

## 11.1 Understanding React Rendering

Before optimizing, it is crucial to understand *why* React apps become slow.

**The Golden Rule of React Rendering:**
A component re-renders when:
1. Its state changes
2. Its props change
3. Its parent re-renders

Performance issues almost always stem from **unnecessary re-renders** (rendering when the output hasn't actually changed) or **expensive computations** during render.

---

## 11.2 React.memo

### What It Does

`React.memo` is a Higher-Order Component (HOC) that memoizes (caches) a component. It prevents the component from re-rendering if its props have not changed.

### When to Use It

- The component re-renders often with the EXACT SAME props.
- The component produces the same result given the same props (a pure component).
- The component is heavy/complex, making its re-rendering expensive.

### When NOT to Use It

- The component's props change frequently (memoization overhead outweighs benefits).
- The component has `children` passed as essentially new elements.
- Wrapping every component (premature optimization).

### Example

```tsx
import React, { memo, useState } from 'react';

interface ExpensiveComponentProps {
  title: string;
  data: number[];
}

// 1. Wrap the component in React.memo
const ExpensiveDataView = memo(function ExpensiveDataView({ title, data }: ExpensiveComponentProps) {
  console.log('ExpensiveDataView rendered!');
  
  // Simulate expensive calculation
  const sum = data.reduce((a, b) => a + b, 0);

  return (
    <div className="expensive-view">
      <h3>{title}</h3>
      <p>Total: {sum}</p>
    </div>
  );
});

// Implementation
function Dashboard() {
  const [count, setCount] = useState(0);
  const [data] = useState([1, 2, 3, 4, 5]);

  return (
    <div>
      {/* Changing count causes Dashboard to re-render */}
      <button onClick={() => setCount(c => c + 1)}>Increment Count: {count}</button>
      
      {/* Without React.memo, this would re-render every time count changes.
          With React.memo, it skips re-rendering because 'title' and 'data' are exactly the same. */}
      <ExpensiveDataView title="My Dashboard Data" data={data} />
    </div>
  );
}
```

### The Reference Equality Trap

`React.memo` uses shallow comparison. If you pass a literal Object, Array, or Function as a prop, it is recreated as a *new reference* on every parent render, breaking the memoization.

```tsx
function Dashboard() {
  const [count, setCount] = useState(0);

  // BAD: [1, 2, 3] is a new array reference on every render
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <ExpensiveDataView title="Stats" data={[1, 2, 3]} /> {/* React.memo FAILS */}
    </div>
  );
}
```

To fix this, you combine `React.memo` with `useMemo` and `useCallback`.

---

## 11.3 useMemo and useCallback

We covered the internals of these hooks in Section 5, but here is how they apply specifically to performance optimization.

### useMemo for Computations and Props

Use `useMemo` to prevent re-creating objects/arrays that are passed as props to memoized components, or to cache expensive calculations.

```tsx
import React, { useMemo, useState } from 'react';

function Dashboard() {
  const [count, setCount] = useState(0);
  const [start, setStart] = useState(1);

  // 1. Caching an expensive calculation
  const expensiveResult = useMemo(() => {
    let result = 0;
    for (let i = start; i < 10000000; i++) {
      result += i;
    }
    return result;
  }, [start]); // Only recompute when 'start' changes

  // 2. Caching an object/array prop
  const chartConfig = useMemo(() => ({
    theme: 'dark',
    showLegend: true,
    dataPoints: [start, start + 1, start + 2]
  }), [start]);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>Count: {count}</button>
      <p>Result: {expensiveResult}</p>
      
      {/* ChartMemoized will NOT re-render when count changes
          because chartConfig reference is stable */}
      <ChartMemoized config={chartConfig} />
    </div>
  );
}
```

### useCallback for Functions

Use `useCallback` to prevent re-creating function definitions on every render, which is crucial when passing callbacks to memoized child components.

```tsx
import React, { useState, useCallback, memo } from 'react';

// Memoized child component
const ActionButton = memo(({ label, onAction }: { label: string, onAction: () => void }) => {
  console.log(`Rendering ${label}`);
  return <button onClick={onAction}>{label}</button>;
});

function Parent() {
  const [text, setText] = useState('');
  const [count, setCount] = useState(0);

  // BAD: New function created every render. ActionButton always re-renders.
  const badHandleClick = () => setCount((c) => c + 1);

  // GOOD: Function reference remains identical unless dependencies change.
  // ActionButton skips re-render when 'text' changes.
  const goodHandleClick = useCallback(() => {
    setCount((c) => c + 1);
  }, []); // Empty dependencies = function never changes identity

  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      
      <ActionButton label="Bad Button" onAction={badHandleClick} />
      <ActionButton label="Good Button" onAction={goodHandleClick} />
    </div>
  );
}
```

---

## 11.4 Code Splitting and Lazy Loading

### What Is Code Splitting?

By default, creating a React app (e.g., via CRA or Vite) bundles all your JavaScript into one large file (`bundle.js`). When a user visits your app, they must download the entire bundle before the app starts, even if they only visit the home page and never see the complex Settings or Admin pages.

Code splitting allows you to split your code into smaller chunks, loading them only when they are needed.

### React.lazy and Suspense

`React.lazy` lets you render a dynamic import as a regular component. It must be wrapped in a `<Suspense>` component, which displays a fallback UI while the chunk is downloading.

```tsx
// App.tsx
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// 1. Regular import (included in main bundle)
import Home from './pages/Home';

// 2. Lazy imports (split into separate JS chunks)
// These files will ONLY download if/when the user navigates to their route
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const ReportingCharts = React.lazy(() => import('./pages/ReportingCharts'));

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/admin">Admin</Link>
        <Link to="/reports">Reports</Link>
      </nav>

      {/* 3. Suspense boundary provides the fallback UI during download */}
      <Suspense fallback={<div className="spinner">Loading route...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/reports" element={<ReportingCharts />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

### Route-Based vs Component-Based Splitting

- **Route-Based (Most Common)**: Split chunks by page (as shown above).
- **Component-Based**: Lazy load heavy components (like a rich text editor or a 3D charting library) even if they are on the initial route, loading them only when the user clicks a button to open them.

---

# Part 12: Form Handling

Forms are a critical part of almost every web application. React handles forms differently than traditional HTML.

## 12.1 Controlled vs Uncontrolled Components

### Controlled Components

In a controlled component, form data is handled entirely by React state. The state is the "single source of truth".

```
+--------------------------------------------------------------+
|                    CONTROLLED COMPONENT                       |
+--------------------------------------------------------------+
|                                                              |
|  1. Input value is tied strictly to state: value={email}     |
|  2. Keystroke fires onChange event                           |
|  3. onChange handler updates state: setEmail(e.target.value) |
|  4. State change triggers re-render                          |
|  5. Input displays new state value                           |
+--------------------------------------------------------------+
```

```tsx
import React, { useState } from 'react';

function ControlledForm() {
  // 1. Create state
  const [username, setUsername] = useState('');

  // 2. Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitted:', username);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Username:
        <input 
          type="text" 
          // 3. Bind value and onChange
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
        />
      </label>
      <button type="submit">Submit</button>
      
      <p>Live preview: {username}</p>
    </form>
  );
}
```

### Uncontrolled Components

In an uncontrolled component, form data is handled by the DOM itself, just like traditional HTML. You use a `useRef` to read the value from the DOM only when needed (usually on submit).

```tsx
import React, { useRef } from 'react';

function UncontrolledForm() {
  // 1. Create a ref
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 2. Read value directly from the DOM node on submit
    const emailValue = emailRef.current?.value;
    console.log('Submitted:', emailValue);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Email:
        {/* 3. Attach the ref. Do NOT use standard 'value' or 'onChange' */}
        <input type="text" ref={emailRef} defaultValue="test@example.com" />
      </label>
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Which should you use?

| Scenario | Controlled | Uncontrolled |
|----------|------------|--------------|
| Instant validation (as you type) | Yes | No |
| Conditionally disabling submit button | Yes | No |
| Enforcing input format (e.g., credit card) | Yes | No |
| Single, simple form submission | Overkill | Yes |
| Integrating with non-React libraries | Harder | Easier |
| File inputs (`<input type="file">`) | No (Read-only) | Must use |

**Rule of Thumb:** Use Controlled Components for 95% of use cases in React.

---

## 12.2 Handling Multiple Inputs

When you have many inputs, creating a separate `useState` for each becomes messy. Instead, use a single state object.

```tsx
import React, { useState } from 'react';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  agreedToTerms: boolean;
}

function ComplexForm() {
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'user',
    agreedToTerms: false
  });

  // Generic change handler based on the 'name' attribute
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const name = target.name;
    
    // Checkboxes use 'checked' instead of 'value'
    const value = target.type === 'checkbox' 
      ? (target as HTMLInputElement).checked 
      : target.value;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form data to send to API:', formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        name="firstName" 
        value={formData.firstName} 
        onChange={handleChange} 
        placeholder="First Name" 
      />
      
      <input 
        name="lastName" 
        value={formData.lastName} 
        onChange={handleChange} 
        placeholder="Last Name" 
      />
      
      <select name="role" value={formData.role} onChange={handleChange}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      
      <label>
        <input 
          type="checkbox" 
          name="agreedToTerms" 
          checked={formData.agreedToTerms} 
          onChange={handleChange} 
        />
        I agree to the terms
      </label>

      <button type="submit" disabled={!formData.agreedToTerms}>
        Register
      </button>
    </form>
  );
}
```

---

## 12.3 Form Validation

Forms require validation before submission. You can manage validation state manually, or use industry-standard libraries.

### Manual Validation Example

```tsx
import React, { useState } from 'react';

function ValidationForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    let isValid = true;

    if (!email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
      isValid = false;
    }

    if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      console.log('Submitting:', { email, password });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Email</label>
        <input 
          value={email} 
          onChange={(e) => {
            setEmail(e.target.value);
            // Optional: Clear error when user starts typing again
            if (errors.email) setErrors({...errors, email: undefined});
          }} 
          className={errors.email ? 'is-invalid' : ''}
        />
        {errors.email && <span className="error-text">{errors.email}</span>}
      </div>
      
      {/* Password field similar... */}
      
      <button type="submit">Login</button>
    </form>
  );
}
```

### Form Libraries (React Hook Form + Zod)

For production applications with complex forms, managing onChange, error state, and touched state manually is tedious.

**React Hook Form** is the modern standard for React forms because it:
1. Minimizes re-renders by utilizing uncontrolled inputs internally.
2. Integrates perfectly with **Zod** (or Yup) for schema-based validation.

```tsx
// Example of a Production-Grade Form using React Hook Form + Zod
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// 1. Define the validation schema using Zod
const registrationSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // Attach the error to the confirmPassword field
});

// Infer the TypeScript type from the Zod schema
type RegistrationFormInputs = z.infer<typeof registrationSchema>;

function ProductionForm() {
  // 2. Initialize React Hook Form
  const { 
    register,           // Registers inputs to the form
    handleSubmit,       // Handles form submission
    formState: { errors, isSubmitting } // Extracts error and loading states
  } = useForm<RegistrationFormInputs>({
    resolver: zodResolver(registrationSchema)
  });

  // 3. Submit handler (only called if validation passes)
  const onSubmit = async (data: RegistrationFormInputs) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Success! Sending data:", data);
    } catch (error) {
      console.error("Submission failed", error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      
      <div className="field">
        <label>Username</label>
        {/* register('username') maps ref, onChange, onBlur automatically */}
        <input {...register("username")} />
        {errors.username && <span className="error">{errors.username.message}</span>}
      </div>

      <div className="field">
        <label>Email</label>
        <input type="email" {...register("email")} />
        {errors.email && <span className="error">{errors.email.message}</span>}
      </div>

      <div className="field">
        <label>Password</label>
        <input type="password" {...register("password")} />
        {errors.password && <span className="error">{errors.password.message}</span>}
      </div>

      <div className="field">
        <label>Confirm Password</label>
        <input type="password" {...register("confirmPassword")} />
        {errors.confirmPassword && <span className="error">{errors.confirmPassword.message}</span>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Registering..." : "Register"}
      </button>

    </form>
  );
}
```

### Why React Hook Form is Better

| Approach | Re-renders | Validation Logic | Boilerplate |
|----------|------------|----------------|-------------|
| Manual Controlled | Every keystroke | Manual JS logic | High |
| React Hook Form | Only on error/submit | Zod Schema | Low |
