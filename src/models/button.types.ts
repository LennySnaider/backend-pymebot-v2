/**
 * src/models/button.types.ts
 *
 * Tipos para nodos de botones y listas interactivas.
 * Define la estructura de datos para la representación de elementos interactivos.
 * @version 1.0.0
 * @created 2025-05-14
 */

/**
 * Representa un botón individual en un nodo de botones
 */
export interface Button {
  id: string;           // Identificador único del botón
  text: string;         // Texto a mostrar en el botón
  value?: string;       // Valor interno (opcional, si es diferente al texto)
  postback?: string;    // Valor a enviar al backend cuando se presiona
  handle?: string;      // Identificador del handle para la conexión (ej: "handle-0")
  url?: string;         // URL para botones que abren enlaces externos
  type?: string;        // Tipo de botón (text, url, phone, etc.)
  iconUrl?: string;     // URL del icono (opcional)
  disabled?: boolean;   // Si el botón está deshabilitado
}

/**
 * Representa un ítem de lista en un nodo de lista
 */
export interface ListItem {
  id: string;           // Identificador único del ítem
  text: string;         // Texto principal del ítem
  description?: string; // Descripción adicional
  value?: string;       // Valor interno (opcional)
  handle?: string;      // Identificador del handle para la conexión
  imageUrl?: string;    // URL de la imagen (opcional)
  disabled?: boolean;   // Si el ítem está deshabilitado
}

/**
 * Metadatos para nodos de botones
 */
export interface ButtonNodeMetadata {
  buttons: Button[];                // Lista de botones
  title?: string;                   // Título opcional para el grupo de botones
  subtitle?: string;                // Subtítulo opcional
  imageUrl?: string;                // URL de imagen opcional
  buttonLayout?: 'vertical' | 'horizontal'; // Disposición de botones
  handlePrefix?: string;            // Prefijo para los handles (ej: "handle-")
  waitForResponse?: boolean;        // Si debe esperar respuesta del usuario
  storeSelectionAs?: string;        // Variable donde guardar la selección
}

/**
 * Metadatos para nodos de lista
 */
export interface ListNodeMetadata {
  items: ListItem[];                // Lista de elementos
  title?: string;                   // Título de la lista
  description?: string;             // Descripción de la lista
  buttonText?: string;              // Texto del botón para mostrar opciones
  searchable?: boolean;             // Si la lista permite búsqueda
  multiSelect?: boolean;            // Si permite selección múltiple
  maxItems?: number;                // Máximo de elementos a mostrar
  waitForResponse?: boolean;        // Si debe esperar respuesta del usuario
  storeSelectionAs?: string;        // Variable donde guardar la selección
}

/**
 * Estructura para respuesta con botones
 */
export interface ButtonResponse {
  text: string;         // Texto del mensaje
  buttons: Button[];    // Botones a mostrar
  title?: string;       // Título opcional
  subtitle?: string;    // Subtítulo opcional
  imageUrl?: string;    // URL de imagen opcional
}

/**
 * Estructura para respuesta con lista
 */
export interface ListResponse {
  text: string;         // Texto del mensaje
  listItems: ListItem[]; // Elementos de la lista
  title?: string;       // Título de la lista
  buttonText?: string;  // Texto del botón para mostrar opciones
  searchable?: boolean; // Si la lista permite búsqueda
}