import os
from contextlib import contextmanager
from psycopg2.pool import ThreadedConnectionPool

_pool: ThreadedConnectionPool | None = None


def get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(minconn=1, maxconn=5, dsn=os.environ["DATABASE_URL"])
    return _pool


@contextmanager
def get_conn():
    """Get a connection from the pool, return it when done."""
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def close_pool():
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None
