# Mastering Spring Security — Authentication, Authorization, and Enterprise Security Architecture Guide

---

**Author:** Senior Java Security Architect
**Target Audience:** Java backend developers with 3+ years experience aiming for architect-level Spring Security expertise
**Prerequisites:** Core Java, Spring Boot, REST APIs, System Design, and basic security concepts

---

# Table of Contents

1. Spring Security Fundamentals & The Bridge Architecture
2. Spring Security Architecture Internals (Deep Dive)
3. Complete Authentication Flow
4. Authentication Providers & Strategy Pattern
5. UserDetails and UserDetailsService Deep Dive
6. Password Security and Encoding
7. JWT Authentication Architecture (Symmetric vs Asymmetric)
8. Spring Security with OAuth2 & OIDC
9. Role-Based Access Control (RBAC)
10. Security Filter Chain Deep Dive
11. Session-Based vs Token-Based Authentication
12. Microservices Security Architecture (Zero-Trust & mTLS)
13. Security Best Practices
14. Production Security Challenges & Scaling Security
15. Complete Spring Boot Security Project
16. Architect-Level Interview Questions (100+)
17. Hands-on Practice Exercises

---

# Part 1: Spring Security Fundamentals & The Bridge Architecture

## 1.1 What is Spring Security?

**Spring Security** is a powerful, highly customizable authentication and access-control framework for Java applications. It is the de-facto standard for securing Spring-based applications.

Spring Security provides:
- **Authentication:** Verifying who you are (login)
- **Authorization:** Verifying what you can do (permissions)
- **Protection:** Against common security exploits (CSRF, XSS, session fixation)

### Deep Concept Explanation

**WHAT:** Spring Security is not just a login library. It is a comprehensive security framework that provides a pluggable architecture for securing every layer of your application — from HTTP transport to method-level business logic. It integrates seamlessly with the Servlet API, Spring MVC, Spring WebFlux, and the entire Spring ecosystem.

**WHY it exists:** Before Spring Security, Java developers had to manually implement security using raw Servlet Filters, custom session management, and hand-written password hashing. This led to inconsistent, buggy, and vulnerable applications. Spring Security standardizes security by providing battle-tested, production-hardened implementations of every common security pattern.

**WHEN to use it:** Any time you build a Spring-based application that requires:
- User login (form-based, JWT, OAuth2, LDAP)
- API endpoint protection
- Role/permission-based access control
- Protection against standard web vulnerabilities

**WHERE it is used in real-world systems:**
- **Banking applications:** Securing transaction APIs, implementing MFA, account lockout
- **E-commerce platforms:** Customer login, admin dashboards, payment API security
- **Healthcare systems:** HIPAA-compliant access control, audit logging
- **SaaS products:** Multi-tenant security, API key authentication for third-party integrations

### How Spring Security Differs: Monolithic vs Microservices

```
MONOLITHIC ARCHITECTURE:
  Client -> [Spring Security Filter Chain] -> Controller -> Service -> Repository
  
  - Single SecurityFilterChain configured in one SecurityConfig class
  - Session/JWT managed in one place
  - All endpoints secured in a single application context
  - CORS typically not needed (same origin)

MICROSERVICES ARCHITECTURE:
  Client -> [API Gateway (Spring Security)] -> Auth Service (issues JWT)
                                            -> Order Service (validates JWT)
                                            -> User Service (validates JWT)
  
  - Each microservice MAY have its own SecurityFilterChain
  - JWT is the standard (sessions don't scale across services)
  - API Gateway acts as the first line of defense
  - Each service can independently authorize requests
  - CORS is critical (frontend on different origin)
```

### Real-World Production Scenario: Securing a Banking Login API

Consider a banking application where users log in to view their account balance:

```
Scenario: User authenticates via POST /api/auth/login

Senior Engineer's Thinking Process:
1. "The login endpoint must be public (permitAll), but ALL other endpoints must be authenticated."
2. "Passwords must be hashed with BCrypt (never stored plain text)."
3. "After 5 failed login attempts, lock the account for 30 minutes."
4. "Return a JWT (not a session) because the mobile app and web app both call this API."
5. "Rate limit the login endpoint to 10 requests per IP per minute to prevent brute force."
6. "Log every authentication attempt (success/failure) for audit compliance."
```

### Security Pitfalls and Common Developer Mistakes

| Mistake | Why It Is Dangerous | Correct Approach |
|---|---|---|
| Using `permitAll()` on all endpoints during development and forgetting to change it | Exposes all APIs to the Internet | Use `authenticated()` by default, explicitly `permitAll()` only for public APIs |
| Disabling CSRF without understanding why | Makes session-based apps vulnerable to forgery attacks | Only disable CSRF for stateless JWT APIs, keep it for session-based apps |
| Storing JWT secret key in `application.yml` | Secret key leaks via Git repo | Use environment variables or Vault |
| Not customizing `AuthenticationEntryPoint` | Returns HTML login page for REST APIs | Return proper JSON 401 responses |
| Using `@Order` incorrectly with multiple filter chains | Wrong filter chain processes the request | Always test with `logging.level.org.springframework.security=DEBUG` |

### Interview Questions: Spring Security Fundamentals

**Q: What default behavior does Spring Security add when you include the starter dependency?**
Every endpoint becomes protected, a default login page is generated, a random password is printed to console, CSRF is enabled, session fixation protection is active, and security headers (HSTS, X-Frame-Options, etc.) are automatically added.

**Q: In a monolithic app, where does Spring Security sit in the request lifecycle?**
It sits BEFORE the `DispatcherServlet`. Spring Security operates as Servlet Filters registered with the embedded Tomcat/Jetty container. The request passes through the entire Security Filter Chain before reaching any `@Controller`.

**Q: In a microservices app, which service should own the SecurityFilterChain?**
Every service that receives HTTP requests should have its own `SecurityFilterChain`. The API Gateway validates the JWT first. Each downstream microservice should ALSO validate the JWT (Zero-Trust model) or at minimum read trusted headers from the Gateway.

---

## 1.2 Architect's View: The Bridge Between Servlet and Spring

Before diving into how to write a login form, a true architect must understand *where* Spring Security sits in the request lifecycle. 

Spring Security operates at the **Servlet Filter** level, long before your request hits the `DispatcherServlet` or your `@RestController`. However, standard Servlet Filters (like Tomcat's filters) do not know about Spring's Application Context (Dependency Injection, Beans, etc.).

So how does a Servlet Filter use Spring Beans like `UserDetailsService` or `JwtService`?

### The Solution: DelegatingFilterProxy

Spring bridges the standard Servlet Container with the Spring Application Context using a specific filter called `DelegatingFilterProxy`.

```
Servlet Container (Tomcat)         Spring Application Context
+-------------------------+        +---------------------------+
| Http Request            |        |                           |
|      v                  |        |                           |
| +---------------------+ |        |   +-------------------+   |
| |DelegatingFilterProxy| | -----> |   | FilterChainProxy  |   |
| +---------------------+ |        |   +-------------------+   |
|      v                  |        |        | Security     |   |
| DispatcherServlet       |        |        | Filters...   |   |
+-------------------------+        +---------------------------+
```

1. **`DelegatingFilterProxy`:** This is a standard Servlet Filter registered with Tomcat/Jetty. Its only job is to intercept the request and "delegate" it to a Spring Bean. It acts as a bridge.
2. **`FilterChainProxy`:** This is the Spring Bean that `DelegatingFilterProxy` delegates the work to. `FilterChainProxy` contains the internal **Security Filter Chain(s)**.

**Why this matters in production:** If you get a security exception before the `DispatcherServlet`, standard Spring `@ControllerAdvice` will **not** catch it. Exceptions thrown in the filter chain must be handled within the filter chain (e.g., via `AuthenticationEntryPoint` or `AccessDeniedHandler`), not in your standard exception handlers.

### Internal Working of the DelegatingFilterProxy Mechanism

When Spring Boot starts up, the following happens internally:

```
1. Spring Boot auto-configures SecurityAutoConfiguration
2. SecurityAutoConfiguration creates a SecurityFilterChain @Bean
3. Spring's SecurityFilterAutoConfiguration registers DelegatingFilterProxy with Tomcat
4. DelegatingFilterProxy looks up the Bean named "springSecurityFilterChain" from ApplicationContext
5. That Bean is actually FilterChainProxy
6. FilterChainProxy maintains a List<SecurityFilterChain>
7. For EACH incoming request, FilterChainProxy finds the FIRST matching chain
8. That chain's filters execute in order
```

```java
// This is conceptually what FilterChainProxy does internally:
public class FilterChainProxy extends GenericFilterBean {
    
    private List<SecurityFilterChain> filterChains;

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        HttpServletRequest request = (HttpServletRequest) req;
        
        // Find the FIRST matching SecurityFilterChain
        for (SecurityFilterChain securityChain : filterChains) {
            if (securityChain.matches(request)) {
                // Execute all filters in THIS chain
                List<Filter> filters = securityChain.getFilters();
                new VirtualFilterChain(filters, chain).doFilter(req, res);
                return;
            }
        }
        // No matching chain found = pass through to DispatcherServlet
        chain.doFilter(req, res);
    }
}
```

### Real-World Production Scenario: Multiple Security Filter Chains

In a production enterprise application, you often need DIFFERENT security configurations for DIFFERENT URL patterns:

```java
// Chain 1: API endpoints use JWT (stateless)
@Bean
@Order(1)
public SecurityFilterChain apiFilterChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/**")
        .csrf(csrf -> csrf.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/auth/**").permitAll()
            .anyRequest().authenticated())
        .build();
}

// Chain 2: Admin console uses form login (session-based)
@Bean
@Order(2)
public SecurityFilterChain adminFilterChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/admin/**")
        .formLogin(form -> form.loginPage("/admin/login"))
        .sessionManagement(s -> s.maximumSessions(1))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/admin/login").permitAll()
            .anyRequest().hasRole("ADMIN"))
        .build();
}

// Chain 3: Actuator endpoints use Basic Auth
@Bean
@Order(3)
public SecurityFilterChain actuatorFilterChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/actuator/**")
        .httpBasic(Customizer.withDefaults())
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health").permitAll()
            .anyRequest().hasRole("OPS"))
        .build();
}
```

**Senior Engineer's Thinking Process:**
- "My REST APIs are consumed by React SPAs and mobile apps — they need stateless JWT."
- "My admin dashboard is a Thymeleaf app — it needs session-based form login."
- "My actuator endpoints are called by Prometheus — they need simple Basic Auth."
- "The `@Order` annotation ensures the API chain is checked FIRST because it is the most specific."

### Performance and Scalability Considerations for FilterChainProxy

| Concern | Impact | Mitigation |
|---|---|---|
| Too many filters in the chain | Each request passes through ALL filters, even if they don't apply | Use `shouldNotFilter()` in your custom `OncePerRequestFilter` to skip non-applicable requests |
| Heavy DB queries inside `UserDetailsService` | Called on every JWT-authenticated request if not careful | Cache `UserDetails` or extract user info directly from the JWT claims instead of hitting the DB |
| Multiple `SecurityFilterChain` beans without proper `@Order` | Wrong chain matches, leading to 401/403 errors | Always use `securityMatcher()` to scope chains and test with security debug logs |

---

## 1.3 Common Security Threats

| Threat | Description | Spring Security Defense |
|---|---|---|
| **SQL Injection** | Malicious SQL in input | JPA/Hibernate parameterized queries |
| **Cross-Site Scripting (XSS)** | Injecting scripts into pages | Response header security (CSP) |
| **CSRF** | Forged requests from other sites | CSRF token validation / SameSite cookies |
| **Session Hijacking** | Stealing session cookies | Session fixation protection, HttpOnly cookies |
| **Brute Force** | Guessing passwords repeatedly | Account lockout, rate limiting, CAPTCHA |
| **Credential Stuffing** | Using leaked credentials | Password encoding (Argon2/BCrypt), MFA |
| **Man-in-the-Middle** | Intercepting network traffic | HTTPS enforcement (HSTS header) |

### Deep Dive: How Each Threat Works in Production

**SQL Injection — Real Scenario:**
An attacker enters `' OR 1=1 --` in the login email field. If the backend uses string concatenation for SQL (`"SELECT * FROM users WHERE email = '" + email + "'"`), the attacker bypasses authentication. Spring Data JPA prevents this because all queries use parameterized prepared statements internally.

**CSRF — Real Scenario:**
A user is logged into their bank at `secure-bank.com` (session cookie stored). The user visits `evil-site.com`, which contains a hidden form that auto-submits `POST secure-bank.com/transfer?to=attacker&amount=10000`. The browser automatically attaches the bank's session cookie. The bank processes the transfer!

Spring Security prevents this by embedding a random `_csrf` token in every form. The attacker's evil form doesn't have this token, so the request is rejected.

**Brute Force — Real Scenario:**
An attacker runs a script testing 1 million common passwords against the admin email. Without rate limiting, the server happily processes all 1 million requests. With Spring Security + a `LoginAttemptService`:

```java
@Service
public class LoginAttemptService {

    private static final int MAX_ATTEMPTS = 5;
    private final LoadingCache<String, Integer> attemptsCache;

    public LoginAttemptService() {
        // Tracks failed login attempts per email, expires after 30 minutes
        attemptsCache = CacheBuilder.newBuilder()
            .expireAfterWrite(30, TimeUnit.MINUTES)
            .build(CacheLoader.from(() -> 0));
    }

    public void loginFailed(String email) {
        int attempts = attemptsCache.getUnchecked(email);
        attemptsCache.put(email, attempts + 1);
    }

    public boolean isBlocked(String email) {
        return attemptsCache.getUnchecked(email) >= MAX_ATTEMPTS;
    }

    public void loginSucceeded(String email) {
        attemptsCache.invalidate(email);
    }
}

// Usage in CustomUserDetailsService:
@Override
public UserDetails loadUserByUsername(String email) {
    if (loginAttemptService.isBlocked(email)) {
        throw new LockedException("Account temporarily locked due to too many failed attempts.");
    }
    // ... normal flow
}
```

### Monolithic vs Microservices: Where Threats Manifest Differently

| Threat | Monolithic Impact | Microservices Impact |
|---|---|---|
| **CSRF** | Single server, session cookies make it HIGH risk | Stateless JWT tokens in headers make it LOW risk |
| **Session Hijacking** | Stealing JSESSIONID gives access to everything | No sessions; attacker must steal the JWT, which expires quickly |
| **Brute Force** | Rate limiting on single server is easy | Must rate limit at the API Gateway level; individual services can't see total request volume |
| **SQL Injection** | Affects one DB | Could affect multiple service databases if shared patterns are used |
| **Token Theft** | Less relevant (sessions) | Critical! Stolen JWT = access to ALL microservices until expiry |

---

# Part 2: Spring Security Architecture Internals (Deep Dive)

## 2.1 Architecture Diagram

```
HTTP Request
     |
     v
+------------------------------------------------------------------+
|                   SECURITY FILTER CHAIN                           |
|                                                                    |
|  +-------------------+                                            |
|  | Security Context  |  Loads SecurityContext from session/token  |
|  | Persistence Filter|  (ThreadLocal storage)                     |
|  +-------------------+                                            |
|           |                                                        |
|  +-------------------+                                            |
|  | Authentication    |  UsernamePasswordAuthenticationFilter      |
|  | Processing Filter |  OR BearerTokenAuthenticationFilter        |
|  +-------------------+                                            |
|           |                                                        |
|           v                                                        |
|  +-------------------+     +------------------------+             |
|  | Authentication    | --> | Authentication         |             |
|  | Manager           |     | Provider               |             |
|  | (ProviderManager) |     | (DaoAuthProvider)      |             |
|  +-------------------+     +------------------------+             |
|                                     |                              |
|                            +--------+--------+                    |
|                            |                 |                    |
|                   +--------v-----+   +-------v--------+          |
|                   |UserDetails   |   |Password        |          |
|                   |Service       |   |Encoder         |          |
|                   |(loads user)  |   |(verifies pwd)  |          |
|                   +--------------+   +----------------+          |
|           |                                                        |
|  +-------------------+                                            |
|  | Exception         |  Handles AuthenticationException           |
|  | Translation Filter|  and AccessDeniedException                 |
|  +-------------------+                                            |
|           |                                                        |
|  +-------------------+                                            |
|  | Authorization     |  Checks roles/authorities                  |
|  | Filter            |  for the requested URL                    |
|  +-------------------+                                            |
+------------------------------------------------------------------+
     |
     v
Controller (if authorized)
```

### Internal Working: Step-by-Step Request Lifecycle

Understanding the exact internal sequence is what separates a developer from an architect. Here is what happens inside Spring Security for EVERY single HTTP request:

```
1. Tomcat receives raw HTTP request on port 8080
   |
2. Tomcat hands request to DelegatingFilterProxy (registered in servlet context)
   |
3. DelegatingFilterProxy delegates to FilterChainProxy (Spring Bean)
   |
4. FilterChainProxy iterates through registered SecurityFilterChain beans
   |  - Finds first chain where securityMatcher matches the request URL
   |
5. SecurityContextPersistenceFilter runs FIRST
   |  - For session-based: loads SecurityContext from HttpSession
   |  - For stateless: SecurityContext is empty (requires JWT filter to populate it)
   |
6. CsrfFilter validates anti-forgery token (if enabled)
   |  - For stateless APIs: this filter is typically disabled
   |
7. Authentication Filters run (e.g., UsernamePasswordAuthenticationFilter)
   |  - For JWT: your custom JwtAuthenticationFilter runs here
   |  - Extracts credentials -> creates unauthenticated Authentication token
   |  - Calls AuthenticationManager.authenticate()
   |    -> ProviderManager loops through AuthenticationProviders
   |    -> DaoAuthenticationProvider calls UserDetailsService
   |    -> PasswordEncoder.matches() is called
   |  - If successful: creates authenticated Authentication token
   |  - Stores in SecurityContextHolder.getContext().setAuthentication()
   |
8. ExceptionTranslationFilter wraps the remaining chain in try-catch
   |  - Catches AuthenticationException -> triggers AuthenticationEntryPoint (401)
   |  - Catches AccessDeniedException -> triggers AccessDeniedHandler (403)
   |
9. AuthorizationFilter checks URL patterns from authorizeHttpRequests()
   |  - Evaluates: permitAll(), authenticated(), hasRole(), hasAuthority()
   |  - If denied: throws AccessDeniedException (caught by step 8)
   |
10. If all filters pass: request reaches DispatcherServlet -> @Controller
```

### Real-World Production Debugging Scenario

**Problem:** A developer reports: "My API returns 403 Forbidden even though the user has ROLE_ADMIN."

**Senior Engineer's Debugging Process:**
```
Step 1: Enable security debug logging
        logging.level.org.springframework.security=DEBUG
        
Step 2: Check the logs for the request:
        - "Checking authorization for GET /api/admin/users"
        - "Principal: null" --> The user is NOT authenticated!
        - Root cause: The JwtFilter is not running before the AuthorizationFilter

Step 3: Verify filter registration:
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
        
Step 4: If Principal IS populated but still 403:
        - Check: User has "ROLE_ADMIN" but config uses hasAuthority("ADMIN")
        - Fix: Either use hasRole("ADMIN") (auto-prefixes ROLE_)
                or store "ROLE_ADMIN" as the authority string
```

---

## 2.2 SecurityContextHolder & Threading Strategies

Once a user is authenticated, their details are stored in the `SecurityContext`. But how does Spring ensure that user A doesn't see user B's auth details if they are making requests at the same exact millisecond?

**ThreadLocal storage.** The `SecurityContextHolder` utilizes the concept of `ThreadLocal`, ensuring that the `SecurityContext` is bound strictly to the current executing Java Thread (which Tomcat assigns per incoming HTTP request).

```java
// Retrieving the current user anywhere in the request thread
SecurityContext context = SecurityContextHolder.getContext();
Authentication auth = context.getAuthentication();
String username = auth.getName();
```

### Deep Concept Explanation: ThreadLocal Under the Hood

**WHAT:** `ThreadLocal` is a Java mechanism that gives each thread its own isolated copy of a variable. When Thread A sets a `ThreadLocal` value, Thread B cannot see it. Spring Security uses this so that each HTTP request thread has its own isolated `SecurityContext`.

**WHY:** In a web server like Tomcat, hundreds of threads handle concurrent requests. Without `ThreadLocal`, all threads would share the same `SecurityContext`, meaning User A's login could overwrite User B's context, leading to catastrophic security bugs (one user seeing another user's data).

**HOW it works internally:**
```java
// Simplified SecurityContextHolder internals
public class SecurityContextHolder {
    
    private static final ThreadLocal<SecurityContext> contextHolder = new ThreadLocal<>();
    
    public static SecurityContext getContext() {
        SecurityContext ctx = contextHolder.get();
        if (ctx == null) {
            ctx = new SecurityContextImpl();
            contextHolder.set(ctx);
        }
        return ctx;
    }
    
    public static void setContext(SecurityContext context) {
        contextHolder.set(context);
    }
    
    public static void clearContext() {
        contextHolder.remove(); // CRITICAL: prevents memory leaks in thread pools!
    }
}
```

### Advanced Architect Concept: Asynchronous Context Propagation

What happens if your Controller spawns a new thread using `@Async` or `CompletableFuture`? 
**The new thread will lose the SecurityContext because it is a different Thread.** 

To solve this, Spring Security provides multiple strategies:

1. **`MODE_THREADLOCAL` (Default):** Context is local to the current thread. Spawning a new thread loses the context.
2. **`MODE_INHERITABLETHREADLOCAL`:** Context is copied from the parent thread to child threads. Works fine if you spawn threads manually, but fails with Thread Pools where threads are reused.
3. **`MODE_GLOBAL`:** Context applies to the entire JVM (useful for swing/desktop applications, terrible for web servers).

**The Architect's Solution for Thread Pools:**
Wrap your Thread Pools with `DelegatingSecurityContextExecutorService` so Spring automatically copies the context into the background thread pool task.

```java
@Bean
public Executor asyncExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(5);
    executor.setMaxPoolSize(10);
    executor.setQueueCapacity(25);
    executor.setThreadNamePrefix("async-security-");
    executor.initialize();
    // Wrap the executor so SecurityContext propagates to @Async methods!
    return new DelegatingSecurityContextExecutor(executor);
}
```

### Real-World Production Scenario: Audit Logging in Background Threads

```
Scenario: After a user places an order, your system sends a confirmation email
          asynchronously using @Async. The email service needs to log WHO placed
          the order for audit compliance.

Problem Without Context Propagation:
  @Async
  public void sendOrderConfirmation(Long orderId) {
      String username = SecurityContextHolder.getContext()
          .getAuthentication().getName();
      // THROWS NullPointerException! SecurityContext is empty in this thread!
  }
  
Solution: Use DelegatingSecurityContextExecutor (configured above)
  Now the @Async method inherits the SecurityContext from the calling thread.
  The audit log correctly records the username.
```

### Monolithic vs Microservices: SecurityContext Behavior

| Aspect | Monolithic | Microservices |
|---|---|---|
| **Context source** | Loaded from HttpSession or JWT on each request | Loaded from JWT only (no shared sessions) |
| **Cross-service context** | N/A (single process) | JWT must be forwarded via FeignClient headers. Each service rebuilds its own SecurityContext from the JWT. |
| **@Async threads** | Use `DelegatingSecurityContextExecutor` | Same solution. Additionally, when emitting Kafka events, serialize the JWT into the message header so consumers can rebuild context. |

### Security Pitfalls: SecurityContextHolder

| Mistake | Consequence | Fix |
|---|---|---|
| Calling `SecurityContextHolder.getContext()` inside a Kafka consumer | Returns null (Kafka threads have no HTTP context) | Explicitly set a system-level `Authentication` in the Kafka listener method |
| Not calling `SecurityContextHolder.clearContext()` at end of request | Memory leak in thread pools; next request on same thread sees stale user | Spring automatically clears it via `SecurityContextPersistenceFilter`, but custom threads must clear manually |
| Using `MODE_INHERITABLETHREADLOCAL` with a fixed-size thread pool | Stale context from previous task leaks into new tasks | Always use `DelegatingSecurityContextExecutor` instead |

---

# Part 3: Complete Authentication Flow

## 3.1 Step-by-Step State Transition Flow

```
Step 1: Client sends login request
        POST /api/auth/login
        { "email": "user@mail.com", "password": "secret123" }
              |
              v
Step 2: Request hits Security Filter Chain
        UsernamePasswordAuthenticationFilter intercepts
        Creates UsernamePasswordAuthenticationToken (unauthenticated)
        auth.isAuthenticated() == false
              |
              v
Step 3: AuthenticationManager receives token
        Delegates to configured AuthenticationProvider(s)
              |
              v
Step 4: DaoAuthenticationProvider processes authentication
        Calls UserDetailsService.loadUserByUsername("user@mail.com")
              |
              v
Step 5: UserDetailsService loads user from database
        Returns UserDetails object with:
        - username, passwordHash, authorities, accountStatus
              |
              v
Step 6: Password validation
        PasswordEncoder.matches("secret123", "$2a$10$...")
        BCrypt compares raw password with stored hash
              |
              v
Step 7: If valid: Create authenticated token
        UsernamePasswordAuthenticationToken is recreated
        auth.isAuthenticated() == true
        Contains: principal (UserDetails), authorities (ROLE_USER)
              |
              v
Step 8: SecurityContextHolder stores authentication
        SecurityContextHolder.getContext().setAuthentication(authToken)
              |
              v
Step 9: Generate response (JWT token or session)
        Return JWT to client for stateless auth
        Or create HTTP session for stateful auth
```

### Deep Concept Explanation

**WHAT:** The Authentication flow is the complete journey of a user's credentials from the HTTP request body to a verified, trusted `Authentication` object stored in the `SecurityContext`. Every subsequent request uses this stored authentication to authorize access.

**WHY this step-by-step matters:** If you skip step 6 (password validation), anyone can log in with any password. If you skip step 8 (storing in SecurityContext), the user is authenticated but Spring doesn't know it — every subsequent API call returns 401.

### Internal Working: The Authentication Token State Machine

The `UsernamePasswordAuthenticationToken` has TWO distinct states. Understanding these is critical for custom implementations:

```java
// STATE 1: UNAUTHENTICATED (created by the filter)
// This constructor sets authenticated = false
UsernamePasswordAuthenticationToken unauthToken =
    new UsernamePasswordAuthenticationToken("user@mail.com", "secret123");
// unauthToken.isAuthenticated() == false
// unauthToken.getPrincipal() == "user@mail.com" (just a string)
// unauthToken.getCredentials() == "secret123" (raw password)

// STATE 2: AUTHENTICATED (created by the provider after verification)
// This constructor sets authenticated = true AND accepts authorities
UsernamePasswordAuthenticationToken authToken =
    new UsernamePasswordAuthenticationToken(
        userDetails,           // principal = full UserDetails object
        null,                  // credentials = null (CLEARED for security!)
        userDetails.getAuthorities()  // ROLE_USER, ROLE_ADMIN etc.
    );
// authToken.isAuthenticated() == true
// authToken.getPrincipal() == CustomUserDetails object
// authToken.getCredentials() == null (password wiped from memory!)
// authToken.getAuthorities() == [ROLE_USER]
```

**Why are credentials set to null after authentication?**
Once the password is verified, there is no reason to keep it in memory. If the server's memory is dumped (e.g., via a heap dump attack or logging mistake), the raw password would be exposed. Setting credentials to `null` is a defense-in-depth practice.

### Real-World Production Scenario: Custom Login Flow for REST APIs

In most production REST APIs, you do NOT use `UsernamePasswordAuthenticationFilter` directly. Instead, you create a custom `AuthController` that manually drives the authentication flow:

```java
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authManager;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody @Valid LoginRequest request) {
        
        // Step 1: Create unauthenticated token
        // Step 2: AuthenticationManager validates via DaoAuthenticationProvider
        // Step 3: If invalid, BadCredentialsException is thrown automatically
        authManager.authenticate(
            new UsernamePasswordAuthenticationToken(
                request.getEmail(), request.getPassword()));

        // Step 4: If we reach here, credentials are valid
        UserDetails user = userDetailsService.loadUserByUsername(request.getEmail());
        
        // Step 5: Generate JWT tokens
        String accessToken = jwtService.generateAccessToken(user);
        String refreshToken = jwtService.generateRefreshToken(user);

        return ResponseEntity.ok(new AuthResponse(accessToken, refreshToken));
    }
}
```

**Senior Engineer's Thinking Process:**
1. "I don't rely on the Spring Security filter for login because I need full control over the JSON response format."
2. "I call `authManager.authenticate()` which internally calls `DaoAuthenticationProvider -> UserDetailsService -> PasswordEncoder`."
3. "If the password is wrong, Spring throws `BadCredentialsException` which my `@ControllerAdvice` catches and returns a 401 JSON response."
4. "After authentication, I generate BOTH an access token (15 min) and a refresh token (7 days)."

### Monolithic vs Microservices: Authentication Flow Differences

```
MONOLITHIC APPLICATION:
  Client -> POST /api/auth/login -> AuthController
          -> AuthenticationManager -> UserDetailsService (same DB)
          -> PasswordEncoder.matches()
          -> Generate JWT -> Return to Client
  
  Everything happens in ONE JVM. The UserDetailsService directly queries
  the same database that stores the user table.

MICROSERVICES ARCHITECTURE:
  Client -> POST /api/auth/login -> API Gateway (routes to Auth Service)
  
  Auth Service:
          -> AuthController -> AuthenticationManager
          -> UserDetailsService -> User DB (Auth Service's own DB)
          -> Generate JWT (signed with PRIVATE key)
          -> Return JWT to Client via Gateway
  
  Subsequent API Call:
  Client -> GET /api/orders -> API Gateway (validates JWT with PUBLIC key)
          -> Forwards to Order Service (also validates JWT)
          -> Order Service extracts userId from JWT claims
          -> Queries Order DB for that user's orders
          
  Key Difference: The Order Service does NOT call UserDetailsService.
  It trusts the JWT claims. This is stateless authentication.
```

---

# Part 4: Authentication Providers & Strategy Pattern

## 4.1 The Strategy Design Pattern in AuthenticationManager

The `AuthenticationManager` does not actually authenticate anything. It uses the **Strategy Design Pattern** via its default implementation, `ProviderManager`. 

The `ProviderManager` maintains a list of `AuthenticationProvider`s. When an authentication request comes in, the `ProviderManager` loops through the providers asking, *"Can you authenticate this type of token?"* The first provider that says "Yes" performs the actual logic.

```java
// Internal concept of how ProviderManager works
for (AuthenticationProvider provider : this.providers) {
    if (provider.supports(authentication.getClass())) {
        try {
            return provider.authenticate(authentication);
        } catch (AuthenticationException e) {
            // Keep trying other providers or throw
        }
    }
}
```
**Architectural Benefit:** This allows your application to support **Database Login (DaoAuthProvider)**, **LDAP Base Authentication**, and **OAuth2/Social Login** simultaneously in the exact same application.

### Deep Concept Explanation: Why the Strategy Pattern?

**WHAT:** The Strategy Pattern is a behavioral design pattern that defines a family of algorithms (authentication methods), encapsulates each one, and makes them interchangeable. The `ProviderManager` is the Context; each `AuthenticationProvider` is a concrete Strategy.

**WHY Spring chose this pattern:** In enterprise environments, a single application might need to authenticate users from 3+ different sources:
- **Employees** authenticate via LDAP (Active Directory)
- **Customers** authenticate via database credentials
- **Third-party integrators** authenticate via API Keys
- **SSO users** authenticate via OAuth2/Keycloak

Without the Strategy Pattern, you'd need a massive `if-else` ladder. With it, you simply register multiple providers and Spring iterates through them.

**HOW the `supports()` method works:**
Each provider declares which type of `Authentication` token it can handle. When `ProviderManager` receives a token, it asks each provider: "Do you support `UsernamePasswordAuthenticationToken.class`?" Only matched providers attempt authentication.

```
ProviderManager receives: UsernamePasswordAuthenticationToken

Provider 1: DaoAuthenticationProvider
  -> supports(UsernamePasswordAuthenticationToken.class)? YES
  -> authenticate() -> loads user from DB, checks password
  -> If success: returns authenticated token
  -> If BadCredentials: ProviderManager tries next provider

Provider 2: LdapAuthenticationProvider
  -> supports(UsernamePasswordAuthenticationToken.class)? YES
  -> authenticate() -> tries LDAP server
  -> If success: returns authenticated token

Provider 3: ApiKeyAuthenticationProvider
  -> supports(UsernamePasswordAuthenticationToken.class)? NO
  -> supports(ApiKeyAuthenticationToken.class)? YES
  -> SKIPPED for this request (wrong token type)
```

### Real-World Production Scenario: Hybrid Authentication System

```
Enterprise Scenario: A hospital management system where:
- Doctors authenticate via hospital's Active Directory (LDAP)
- Patients authenticate via email/password stored in PostgreSQL
- IoT medical devices authenticate via API keys

Solution: Register three AuthenticationProviders in ProviderManager

@Configuration
public class MultiProviderConfig {

    @Bean
    public AuthenticationManager authManager(
            DaoAuthenticationProvider dbProvider,
            LdapAuthenticationProvider ldapProvider,
            ApiKeyAuthenticationProvider apiKeyProvider) {
        return new ProviderManager(
            List.of(dbProvider, ldapProvider, apiKeyProvider)
        );
    }
}
```

---

## 4.2 DaoAuthenticationProvider (Most Common)

Authenticates using a `UserDetailsService` and `PasswordEncoder`.

```java
@Bean
public AuthenticationProvider daoAuthProvider() {
    DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
    provider.setUserDetailsService(userDetailsService);
    provider.setPasswordEncoder(passwordEncoder());
    return provider;
}
```

### Internal Working of DaoAuthenticationProvider

```
1. Receives UsernamePasswordAuthenticationToken
2. Extracts username from token.getPrincipal()
3. Calls UserDetailsService.loadUserByUsername(username)
4. If user not found: throws UsernameNotFoundException
5. Checks UserDetails status flags:
   - isEnabled() == false? throws DisabledException
   - isAccountNonLocked() == false? throws LockedException
   - isAccountNonExpired() == false? throws AccountExpiredException
6. Calls PasswordEncoder.matches(rawPassword, storedHash)
   - If mismatch: throws BadCredentialsException
7. Checks isCredentialsNonExpired()
   - If expired: throws CredentialsExpiredException
8. Creates fully authenticated UsernamePasswordAuthenticationToken
9. Returns to ProviderManager -> SecurityContextHolder stores it
```

### Security Pitfall: Timing Attacks on User Enumeration

**Problem:** If `loadUserByUsername()` throws `UsernameNotFoundException`, the response is faster than when the username exists but the password is wrong (because BCrypt matching takes ~100ms). An attacker can measure response times to determine which emails are registered.

**Spring Security's Defense:** `DaoAuthenticationProvider` has a built-in mitigation. If the user is not found, it STILL runs `PasswordEncoder.matches()` against a dummy hash to equalize response times. This behavior is automatic.

---

## 4.3 Custom Provider Implementation (e.g. API Key)

In microservices, you might authenticate based on an `X-API-Key` header instead of a password.

```java
@Component
public class ApiKeyAuthenticationProvider implements AuthenticationProvider {

    @Autowired
    private ApiKeyRepository apiKeyRepository;

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        String apiKey = (String) authentication.getCredentials();
        
        ApiKeyEntity entity = apiKeyRepository.findByKey(apiKey)
            .orElseThrow(() -> new BadCredentialsException("Invalid API Key"));
            
        return new ApiKeyAuthenticationToken(
            entity.getOwnerId(), 
            null, 
            List.of(new SimpleGrantedAuthority("ROLE_API_CLIENT"))
        );
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return ApiKeyAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
```

### Step-by-Step: Complete API Key Authentication Implementation

To make the above work in production, you also need a custom filter that extracts the API key from the request header:

```java
// Step 1: Create a custom Authentication token
public class ApiKeyAuthenticationToken extends AbstractAuthenticationToken {

    private final String apiKey;
    private final Object principal;

    // Unauthenticated constructor (filter creates this)
    public ApiKeyAuthenticationToken(String apiKey) {
        super(null);
        this.apiKey = apiKey;
        this.principal = null;
        setAuthenticated(false);
    }

    // Authenticated constructor (provider creates this)
    public ApiKeyAuthenticationToken(Object principal, String apiKey,
            Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.principal = principal;
        this.apiKey = apiKey;
        setAuthenticated(true);
    }

    @Override public Object getCredentials() { return apiKey; }
    @Override public Object getPrincipal() { return principal; }
}

// Step 2: Create the filter that extracts API key from header
@Component
public class ApiKeyAuthenticationFilter extends OncePerRequestFilter {

    @Autowired private AuthenticationManager authManager;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        String apiKey = request.getHeader("X-API-Key");
        if (apiKey != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Authentication auth = authManager.authenticate(
                    new ApiKeyAuthenticationToken(apiKey));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (AuthenticationException e) {
                // Invalid API key - continue chain, will be caught by AuthorizationFilter
            }
        }
        chain.doFilter(request, response);
    }
}

// Step 3: Register the filter in SecurityConfig
@Bean
public SecurityFilterChain apiKeyChain(HttpSecurity http) throws Exception {
    return http
        .securityMatcher("/api/external/**")
        .addFilterBefore(apiKeyFilter, UsernamePasswordAuthenticationFilter.class)
        .authorizeHttpRequests(auth -> auth.anyRequest().hasRole("API_CLIENT"))
        .build();
}
```

---

# Part 5: UserDetails and UserDetailsService Deep Dive

## 5.1 Custom UserDetails Implementation

Your database User domain entity should NOT implement `UserDetails` directly. This violates the Single Responsibility Principle. Instead, create a wrapper.

### Deep Concept Explanation

**WHAT:** `UserDetails` is Spring Security's representation of a user. It is NOT your JPA entity. It is a security-specific contract that tells Spring: "Here is the username, the hashed password, the list of roles/authorities, and whether the account is active/locked/expired."

**WHY create a wrapper instead of implementing UserDetails on the JPA entity:**
1. **Single Responsibility:** Your `User` entity should model business data (name, address, phone). Security concerns (authorities, account locking) should be separate.
2. **Serialization issues:** `UserDetails` is stored in `SecurityContext`. If your JPA entity has lazy-loaded relationships (e.g., `@OneToMany(fetch = LAZY)`), serialization fails with `LazyInitializationException`.
3. **Flexibility:** You might change your DB schema but don't want to break Spring Security's contract.

```java
@Getter
public class CustomUserDetails implements UserDetails {

    private final Long id;
    private final String email;
    private final String password;
    private final Collection<? extends GrantedAuthority> authorities;
    private final boolean active;
    private final boolean locked;

    public CustomUserDetails(User user) {
        this.id = user.getId();
        this.email = user.getEmail();
        this.password = user.getPasswordHash();
        this.authorities = user.getRoles().stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getName()))
            .collect(Collectors.toList());
        this.active = user.isActive();
        this.locked = user.isLocked();
    }

    @Override public String getUsername() { return email; }
    @Override public String getPassword() { return password; }
    @Override public boolean isEnabled() { return active; }
    @Override public boolean isAccountNonLocked() { return !locked; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }
}
```

### Real-World Production Scenario: Multi-Tenant UserDetails

In a SaaS application, each user belongs to a tenant (company). The `CustomUserDetails` must carry the tenant ID so that every DB query is scoped to the correct tenant:

```java
@Getter
public class TenantAwareUserDetails implements UserDetails {
    
    private final Long userId;
    private final Long tenantId;      // CRITICAL for multi-tenancy
    private final String tenantName;
    private final String email;
    private final String password;
    private final Collection<? extends GrantedAuthority> authorities;
    
    // ... constructors and methods
}

// Usage in a service:
@PreAuthorize("hasRole('USER')")
public List<Order> getMyOrders() {
    TenantAwareUserDetails user = (TenantAwareUserDetails) 
        SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    
    // ALWAYS scope DB queries to the tenant!
    return orderRepository.findByTenantIdAndUserId(user.getTenantId(), user.getUserId());
}
```

---

## 5.2 Thread-Safe CustomUserDetailsService

```java
@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email)
            throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException(
                "User not found with email: " + email));

        if (!user.isActive()) {
            throw new DisabledException("Account is deactivated");
        }
        if (user.isLocked()) {
            throw new LockedException("Account is locked");
        }

        return new CustomUserDetails(user);
    }
}
```

### Performance Consideration: Caching UserDetails

In a JWT-based architecture where your `JwtFilter` calls `loadUserByUsername()` on EVERY request, you are hitting the database on every API call. This defeats the purpose of stateless JWTs!

**Solution 1: Extract user info from JWT claims (no DB hit)**
```java
// In JwtFilter: Build Authentication from JWT claims directly
if (jwtService.isTokenValid(token, username)) {
    List<SimpleGrantedAuthority> authorities = jwtService.extractRoles(token).stream()
        .map(SimpleGrantedAuthority::new).toList();
    
    // Create Authentication WITHOUT calling UserDetailsService!
    UsernamePasswordAuthenticationToken auth =
        new UsernamePasswordAuthenticationToken(username, null, authorities);
    SecurityContextHolder.getContext().setAuthentication(auth);
}
```

**Solution 2: Cache UserDetails with Caffeine**
```java
@Service
public class CachingUserDetailsService implements UserDetailsService {
    
    private final UserRepository userRepository;
    private final Cache<String, UserDetails> cache = Caffeine.newBuilder()
        .maximumSize(10_000)
        .expireAfterWrite(5, TimeUnit.MINUTES)
        .build();
    
    @Override
    public UserDetails loadUserByUsername(String email) {
        return cache.get(email, this::loadFromDb);
    }
    
    private UserDetails loadFromDb(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new UsernameNotFoundException("Not found: " + email));
        return new CustomUserDetails(user);
    }
}
```

---

# Part 6: Password Security and Encoding

## 6.1 Why Password Encoding is Non-Negotiable

```
Plain text:   password123          (compromised = instant access)
MD5 hash:     482c811da5d5b4...   (weak, rainbow table attacks)
SHA-256:      ef92b778bafe77...   (weak, no salt)
BCrypt:       $2a$10$N9qo8uL...  (strong, salted, slow by design)
```

### Deep Concept Explanation

**WHAT:** Password encoding is the process of converting a plain-text password into a cryptographic hash that CANNOT be reversed. Even if an attacker steals your entire database, they cannot recover the original passwords.

**WHY it's non-negotiable:** Every major data breach in history (LinkedIn 2012 - 6.5M passwords, Adobe 2013 - 153M passwords) was devastating BECAUSE passwords were stored as plain text or weak hashes (MD5/SHA-1). With BCrypt, even if an attacker steals your user table, cracking each password would take thousands of CPU-years.

**WHEN to use which encoder:**
- **New project:** Use `BCryptPasswordEncoder(12)` (battle-tested, fast enough for most apps)
- **High-security financial systems:** Use `Argon2PasswordEncoder` (latest standard, resists GPU attacks)
- **Migrating legacy system:** Use `DelegatingPasswordEncoder` (supports both old and new hashes)

### Real-World Production Scenario: A Database Leak

```
Scenario: An attacker downloads your entire users table containing 10 million rows.

With Plain Text Passwords:
  All 10 million accounts are instantly compromised.
  
With MD5 (no salt):
  The attacker uses a Rainbow Table (pre-computed MD5 hashes of common passwords).
  80% of passwords are cracked within minutes.
  
With SHA-256 (no salt):
  Same attack as MD5 but with SHA-256 rainbow tables.
  Slightly slower but still very fast.
  
With BCrypt (strength 12):
  Each password verification attempt takes ~200ms.
  To crack ONE password by brute force: 200ms x 1 billion attempts = 6.3 years.
  To crack ALL 10 million: virtually impossible with current hardware.
```

---

## 6.2 Password Encoders

| Encoder | Strength | Speed | Use In Production? |
|---|---|---|---|
| `BCryptPasswordEncoder` | Strong | ~100ms | Yes (Default, highly recommended) |
| `Argon2PasswordEncoder` | Strongest | ~300ms | Yes (Latest industry standard, memory-hard) |
| `SCryptPasswordEncoder` | Very strong | ~200ms | Yes (memory-hard) |
| `NoOpPasswordEncoder` | None | Instant | NEVER (unit testing only) |

### How to Choose: Senior Engineer's Decision Framework

```
Question 1: Is this a new greenfield project?
  -> Yes: Use BCryptPasswordEncoder(12). It's the industry standard.
  
Question 2: Is this a high-security financial/healthcare system?
  -> Yes: Use Argon2PasswordEncoder. It's memory-hard (resists GPU and ASIC attacks).
  
Question 3: Am I migrating from a legacy system with SHA/MD5 hashes?
  -> Yes: Use DelegatingPasswordEncoder.
         Register both old (MD5/SHA) and new (BCrypt) encoders.
         Upon login, transparently re-hash from old to new.
         
Question 4: What BCrypt strength should I use?
  -> Strength 10: ~100ms per hash (good for most web apps)
  -> Strength 12: ~200ms per hash (recommended for sensitive apps)
  -> Strength 14: ~800ms per hash (slows login noticeably, use only if justified)
  -> NEVER go below 10 in production!
```

---

## 6.3 Advanced Concept: BCrypt Architecture

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12); // Strength 12 (2^12 iterations)
}

// Registration: encode password before saving
String rawPassword = "secret123";
String encoded = passwordEncoder.encode(rawPassword);
// $2a$12$LJ3m4ys1jN6cVKkWJPz2U.Bj6YOyI1L5lq0A9X5JVfKq3O7/HZOW.
// Each encode() call produces DIFFERENT output because the salt is randomly generated and embedded in the string.
```

### How BCrypt Works Internally
```
Input: "secret123"

Step 1: Generate random salt (22 characters)
        Salt: LJ3m4ys1jN6cVKkWJPz2U.

Step 2: Hash password + salt using Blowfish cipher
        Run 2^12 = 4096 iterations (Intentional Work Factor!)

Step 3: Combine: $2a$12$<salt><hash>
        $2a$12$LJ3m4ys1jN6cVKkWJPz2U.Bj6YOyI1L5lq0A9X5JVfKq3O7/HZOW.

Architectural Defense:
1. The random salt prevents Rainbow Table attacks (pre-computed hash dictionaries).
2. The intentional slowness (4096 iterations) prevents GPU brute-forcing from easily guessing passwords if your database is leaked.
```

### Dissecting a BCrypt Hash String
```
$2a$12$LJ3m4ys1jN6cVKkWJPz2U.Bj6YOyI1L5lq0A9X5JVfKq3O7/HZOW.
 |  |  |________________________|___________________________________|
 |  |           |                              |
 |  |       22-char salt              31-char hash
 |  |
 | Cost factor (2^12 = 4096 rounds)
 |
 Algorithm version (2a = modern BCrypt)
```

**Why `encode()` produces different outputs each time:**
Each call generates a NEW random 22-character salt. So `encode("secret123")` will produce a different string every time. But `matches("secret123", storedHash)` always works because it extracts the salt FROM the stored hash and re-computes.

---

## 6.4 Zero-Downtime Password Migrations: DelegatingPasswordEncoder

If a system used weak MD5 hashes for ten years, how does an Architect securely migrate 1 million users to BCrypt without forcing everyone to reset their passwords?

The answer: **DelegatingPasswordEncoder**.

```java
@Bean
public PasswordEncoder passwordEncoder() {
    Map<String, PasswordEncoder> encoders = new HashMap<>();
    encoders.put("bcrypt", new BCryptPasswordEncoder());
    encoders.put("MD5", new MessageDigestPasswordEncoder("MD5"));
    
    // Default to BCrypt for all new registrations/updates
    DelegatingPasswordEncoder passwordEncoder = 
        new DelegatingPasswordEncoder("bcrypt", encoders);
    
    // Automatically upgrades MD5 hashes to BCrypt upon successful login!
    return passwordEncoder;
}
```
*How it works:* The database stores strings like `{MD5}abc123hash...` or `{bcrypt}$2a...`. Spring looks at the `{id}` prefix to know which decoder to use. Upon successful MD5 login, the raw password is automatically re-hashed using BCrypt and saved!

### Step-by-Step: Implementing Transparent Password Migration

```java
// Step 1: Configure DelegatingPasswordEncoder (shown above)

// Step 2: Create a custom AuthenticationSuccessHandler that re-hashes on login
@Component
@RequiredArgsConstructor
public class PasswordUpgradeHandler implements AuthenticationSuccessHandler {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
            HttpServletResponse response, Authentication authentication) {
        
        // Check if the stored hash uses the legacy encoder
        CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();
        String storedHash = user.getPassword();
        
        if (storedHash.startsWith("{MD5}") || storedHash.startsWith("{SHA}")) {
            // Re-hash with BCrypt using the raw password from the login form
            String rawPassword = request.getParameter("password");
            String bcryptHash = passwordEncoder.encode(rawPassword);
            
            userRepository.updatePassword(user.getId(), bcryptHash);
            // Database now stores: {bcrypt}$2a$12$...
            // Next login: Spring uses BCrypt directly, no MD5 involved
        }
    }
}
```

### Monolithic vs Microservices: Password Migration Differences

| Aspect | Monolithic | Microservices |
|---|---|---|
| **Migration location** | Single `UserDetailsService` handles everything | Only the Auth Service owns user credentials. Other services never see passwords. |
| **Database** | One user table in one DB | Auth Service has its own dedicated User DB. Migrating only affects one service. |
| **Rollback strategy** | Roll back the JAR deployment | Roll back only the Auth Service container. Other microservices are unaffected. |
| **Testing** | Test login flow in one integration test | Test Auth Service in isolation. API Gateway and downstream services don't change. |
