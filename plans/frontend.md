# Frontend Plan - Family Tree Builder Client

This document outlines the frontend UI design, component structures, React Flow integration, Dagre layout config, and state management for the Next.js/TypeScript frontend.

## 1. Directory Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Google Fonts, Theme Providers (next-themes), Auth Wrapper
│   │   ├── page.tsx           # Product landing/marketing welcome page
│   │   ├── auth/              # Auth callbacks / Login UI
│   │   ├── dashboard/         # Core user dash (tree lists, tree creation dialog)
│   │   └── tree/[id]/         # Main family tree canvas interface
│   ├── components/
│   │   ├── ui/                # shadcn UI components (button, sheet, input, etc.)
│   │   ├── tree-canvas.tsx    # React Flow Canvas view
│   │   ├── person-node.tsx    # Custom Node card displaying name, avatar, details
│   │   ├── person-drawer.tsx  # Mobile-first slide drawer for view/editing/relations
│   │   ├── relation-forms.tsx # Forms to create spouse / parent / child nodes
│   │   └── tree-header.tsx    # Tree settings, breadcrumbs, styling options (Theme toggler)
│   ├── hooks/
│   │   └── use-auth.ts        # Hook managing Google Login & local JWT session
│   ├── context/
│   │   └── auth-context.tsx   # React context containing user state & access tokens
│   ├── lib/
│   │   ├── api-client.ts      # Axios/Fetch setup with JWT interceptors
│   │   └── layout-engine.ts   # Dagre Graph hierarchy layouts calculator
│   └── types/
│       └── index.ts           # Shared TypeScript interfaces (Tree, Person, Edge)
├── public/
├── package.json
└── tailwind.config.js
```

---

## 2. React Flow canvas Integration

We will implement **React Flow v11+ / React Flow XYFlow (or latest)** to build our tree canvas:

### Custom Edges & Interactive Labels
* **Visual Distinctions (Adaptive Styles)**:
  * **Spouse Connections**: Horizontal lines. `married` is a solid violet line, `partner` is a solid teal line, and `divorced` is a dashed gray line.
  * **Parent-Child Connections**: Vertical connections with downwards arrows. `biological` is a solid slate-gray line, `adopted` is a dashed slate-gray line, and `step` is a thin, light-gray line.
* **Global Label Switch**: A "Show Labels" toggle in the canvas header. When turned **ON**, all lines display their relationship label (e.g., `"Spouse"`, `"Parent"`) directly on the line.
* **On-Click Highlighting**: When the global switch is **OFF**, clicking an individual edge highlights the connection (changing color and thickness) and dynamically renders its relationship label. Clicking away deselects the edge.

### Custom Nodes (`PersonNode`)
Custom nodes allow us to display a premium card representation:
* **Layout**: Displays a 50x50 rounding avatar, status indicators (e.g. gray outline if deceased), age/birth years, and relation triggers.
  * *Image Lightbox*: Clicking the 50x50 circular avatar will open a polished Dialog/Lightbox modal displaying the high-resolution expanded photo. Clicking outside the layout or close icon dismisses it. Clicking elsewhere on the card opens the details drawer.
* **Handles**:
  * Top handle (`target`): For incoming parent connections.
  * Bottom handle (`source`): For outgoing child connections.
  * Side handles (`source/target`): For horizontal spouse connections.
  * *Note on Siblings*: Siblings are not connected to each other directly. Instead, they share incoming connections from the same parent nodes. The Dagre layout engine automatically structures them side-by-side on the same horizontal row under their parent(s).

### Layout Engine (`layout-engine.ts` using Dagre)
Because users don't want to manually position family members, canvas loading triggers an automated Dagre render:
```typescript
import dagre from '@dagrejs/dagre';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

export const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction, nodesep: 70, ranksep: 100 });

  nodes.forEach((node) => {
    // Standard node dimensions
    dagreGraph.setNode(node.id, { width: 180, height: 90 });
  });

  edges.forEach((edge) => {
    // Spouses must be kept adjacent (same level key). We give them a heavy weight and minlen of 1.
    const isSpouse = edge.data?.relationType === 'spouse';
    dagreGraph.setEdge(edge.source, edge.target, {
      weight: isSpouse ? 10 : 1,
      minlen: isSpouse ? 1 : 2,
    });
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 90, // center offset
        y: nodeWithPosition.y - 45,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};
```

---

## 3. Mobile-First Drawer Interface

To satisfy mobile requirements, we make the editor details a Radix `Sheet` (drawer):
* **Responsive Styling**:
  * On desktop: Slides in from the right (`sm:max-w-md w-full h-full`).
  * On mobile: Slides up from the bottom (`w-full h-[85vh] bottom-0 rounded-t-xl`).
* **Inside the Drawer**:
  * **View tab**: Interactive list of properties (native place, current place, dob, occupation).
  * **Edit Profile**: Text inputs, gender selections, and a file-uploader to change the profile picture.
  * **Custom Fields Section**: An interactive "+" button. The user types a name (e.g., "Favorite Dish") and a value (e.g., "Lasagna"). This appends to the `custom_fields` record database model.
  * **Quick Relationship Forms**: Add direct family connections:
    * `Add Spouse`: Automatically creates a new Person node, links relation, and rerenders Dagre layout.
    * `Add Child`: Automatically creates child node, links parent relationship, and updates layout.
    * `Add Parent`: Automatically adds parent, routes parent link downward to active node, and recalculates coordinates.

---

## 4. Theme Configuration (Dark / Light Theme Toggle)

To deliver a premium visual experience:
* We integrate `next-themes` and bind Tailwind variables to support system, light, and dark modes cleanly.
* **Global Provider**: Wrapper in `src/app/layout.tsx` (`<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`).
* **Header Toggle**: A client button component (`TreeHeader` / `dashboard`) toggling between light, dark, and system themes using Radix dropdown menu and Lucide icons `Sun` & `Moon`.
* **React Flow Adjustments**:
  * Grid coordinates background: Uses conditional styles depending on active theme class (`.react-flow__background` style overrides).
  * Nodes and edges: Adaptive color tones (e.g. text/edges render soft gray/white in dark mode, charcoal/slate in light mode).

---

## 5. UI Layouts & Wireframe Specs

Below is the layout specification for each screen, outlining core grids, components, and responsive adaptations.

### Screen A: Welcome Landing Page (`/`)
* **Header Navigation**:
  * Left: App Logo & Brand Name ("Clans & Branches")
  * Right: Light/Dark Mode Toggle, "Login with Google" button. If the backend is running in Dev Bypass Mode (no Client ID set), a secondary **"Developer Login Bypass"** button is displayed.
* **Hero Panel**:
  * Premium gradient title ("Map Your Family Lineage Effortlessly")
  * Interactive, floating mockup nodes illustrating connecting parents, children, and spouses.
  * Prominent action button: **"Build Your Tree Now (Free)"** triggering the `/dashboard` dashboard landing routing.
* **Features Grid (3-column layout)**:
  * Column 1: **Hierarchical Auto-Layout** (Never worry about arranging or overlapping nodes).
  * Column 2: **Cloudinary Sync** (Upload and optimize high-resolution family photos).
  * Column 3: **Dynamic Custom Fields** (Track native places, custom notes, professions, and alive state).

### Screen B: Main Dashboard (`/dashboard`)
* **Global Sticky Header**: Header tracking user session:
  * Brand Logo dropdown linking back to Dashboard.
  * User menu containing Google avatar, user email, and "Logout" button.
  * Theme switcher (Light / Dark).
* **Main Area Grid**:
  * A heading title: **"Your Family Trees"**.
  * Grid items representing individual trees. Card layout details:
    * Tree Name, Description, Created timestamp, Count indicator showing number of people registered.
    * CTA buttons: **"Open Canvas"** (primary solid) & **"Delete"** (secondary red outline).
      * **Delete Confirmation**: Deleting a tree opens a Dialog warning the user that all member nodes and relationship links will be lost permanently, requiring them to type the tree's name to confirm.
  * **"New Tree" placeholder card**:
    * Clean dashed border outline containing a large outline `Plus` icon and "Create Tree".
    * Clicking triggers a Radix Dialog modal asking for **Name** and **Description**.

### Screen C: Tree Canvas (`/tree/[id]`)
* **UI Skeleton**: Full-viewport height container (`h-screen overflow-hidden flex flex-col`).
* **Header Navigation (Sticky Top)**:
  * Breadcrumb links: `Dashboard / Tree Name`
  * Action items: **"Export Tree (Image)"** button (uses standard `html-to-image` dependency to bundle the React Flow canvas HTML nodes and generate a PNG download link directly in the browser), theme toggle, and User avatar menu.
* **React Flow Workspace Area (Dynamic Canvas)**:
  * Uses custom grid backgrounds (dotted mesh) adapting to active color themes.
  * **Person Node Card (Custom React Flow Node)**:
    * Compact styled container (width: 180px, height: 90px). Glassmorphic outline styling.
    * Left side: Rounded circular avatar photo (using Google Image or Cloudinary CDN redirect).
    * Right side: Name (bold, 1 line), lifespan year subtitle (flexible rendering: `YYYY - YYYY` if both known, `YYYY - Present` if alive, `YYYY - ?` or `? - YYYY` for partial dates, and hidden if both are unknown). If the person is deceased, displays a small skull icon (`Skull` from lucide-react) next to their name or lifespan as a clear, polished status indicator.
    * Connecting handles on ports (top: Parents input, bottom: Children output, side: Spouse connectors).
  * **Interactive Floating Toolbar (Lower Left)**:
    * Quick zoom in (`+`), zoom out (`-`), center view (fit-to-screen), and **"Recalculate Layout"** button (re-triggers Dagre rendering).
* **Interactive Slide Sheet Drawer (`PersonDrawer`)**:
  * Radix UI `<Sheet>` activated by selecting a Person Node card.
  * **Mobile Presentation**: Bottom drawer sliding up (`w-full max-h-[85vh] bottom-0 rounded-t-2xl px-4 py-6`).
  * **Desktop Presentation**: Right bar sliding in (`h-screen w-full sm:max-w-md right-0 top-0 border-l border-border bg-background`).
  * **Content Tabs**:
    * **Tab 1: Profile**: Views age, birth dates, native/current places, and lists dynamic custom attributes.
    * **Tab 2: Edit**: Field controls (Inputs, Select options) and a Cloudinary-direct file uploader widget.
    * **Tab 3: Relations**: Button links: `[Add Mother]`, `[Add Father]`, `[Add Spouse]`, `[Add Son]`, `[Add Daughter]`. Clicking any prompts a modal form to input the person's name and details, creates the DB node/relation, and automatically lays out the canvas.
    * **Profile Deletion Warn**: A distinct "Delete Member" button is visible at the bottom of the drawer. Clicking it draws a mandatory `AlertDialog` warning: *"Are you sure you want to delete [Name]? This will permanently remove this person from the tree, along with all of their relationship connection lines. Other family members themselves will not be deleted."*

---

## 7. App Initialization & Cold-Start Loader

To ensure a high-quality user experience even when deployed on free-tier services (Render/Railway) where servers sleep:

### Cold-Start Detection
* On mounting the Client App (Landing or Dashboard), we issue a lightweight `/healthinfo` or ping request to `/api/v1/auth/me`.
* If the request takes longer than 1.5 seconds, or if the server reports a boot latency:
  * The frontend renders a fullscreen glassmorphic Loading Backdrop.

### Loader View
* **Header Message**: *"Establishing connection with tree server..."*
* **Dynamic Quote Carousel**: A central spinner accompanied by cycling text quote cards:
  * *"Like branches on a tree we grow in different directions, yet our roots remain as one."*
  * *"Family is not an important thing. It's everything."*
  * *"The bond that links your true family is not one of blood, but of respect and joy in each other's life."*
  * *"Other things may change us, but we start and end with the family."*
* Texts loop every 6 seconds to keep the user engaged until the backend finishes waking up. Once the server responds, the canvas fades in cleanly.

---

## 6. Disconnected Subgraphs & Sidebar Pooling

To manage cases where you know a relative or isolated branch but don't yet know how they connect to the main family lineage:

### Graph Decomposition (Client-Side)
Upon fetching the list of people and relationships for a tree:
1. We run a standard Breadth-First Search (BFS) or Depth-First Search (DFS) component partitioning algorithm over the nodes and edges.
2. The nodes are grouped into three categories:
   * **Main Tree**: The single largest connected group of nodes. This occupies the main React Flow canvas window.
   * **Partial Trees**: Smaller clusters of size $\ge 2$ (e.g., an uncle's family of 3 whom you haven't linked to the grandfather yet).
   * **Unconnected People**: Single nodes (size 1) representing individuals with zero relationship edges.

### UI Representation
Instead of rendering multiple floating tree clusters on the canvas (which causes visual clutter and sorting problems), we handle them in a collapsible **Sidebar Pooling Deck** on the right side of the screen:
* **"Unconnected People" Tab**: A lists of names/avatars. Clicking them lets you edit their facts or prepare a relationship link.
* **"Sub-Branches" Tab**: Lists cluster groups (e.g. *"Michael's Branch (3 people)"*). You can preview a mini-graph representation of any sub-branch.

### Merging Workflow
Once you discover how a partial tree or unconnected relative connects to the main family tree:
1. Open the relative's profile in the sidebar pool.
2. Select **"Connect to Tree"** and pick the target person (from the Main Tree) and relationship type/subtype.
3. The backend saves the relationship edge.
4. The client fetches the updated graph. The component partition algorithm runs again, detects that the component is now connected, deletes it from the sidebar list, and recalculates the single main Dagre layout. The canvas then smoothly centers/zooms onto the newly merged branch.
