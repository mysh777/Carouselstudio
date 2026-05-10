export type ToastKind = 'success' | 'error' | 'info';
export type ToastItem = { id: number; kind: ToastKind; message: string };

type Listener = (items: ToastItem[]) => void;

class ToastBus {
  private items: ToastItem[] = [];
  private listeners = new Set<Listener>();
  private nextId = 1;

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.items);
    return () => {
      this.listeners.delete(l);
    };
  }

  private emit() {
    for (const l of this.listeners) l(this.items);
  }

  push(kind: ToastKind, message: string) {
    const id = this.nextId++;
    this.items = [...this.items, { id, kind, message }];
    this.emit();
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: number) {
    this.items = this.items.filter((x) => x.id !== id);
    this.emit();
  }

  success(m: string) { this.push('success', m); }
  error(m: string) { this.push('error', m); }
  info(m: string) { this.push('info', m); }
}

export const toast = new ToastBus();
