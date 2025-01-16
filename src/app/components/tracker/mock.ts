import { ActionType } from "../../services/websocket.service";
import { MessageFlow } from "./tracker.component";

export const MOCK_DATA: MessageFlow[] = [
    {
        status: 'success',
        receivedAt: new Date('2024-01-20T10:00:00'),
        completedAt: new Date('2024-01-20T10:00:01'),
        brokerProcessingTime: 50,
        timeout: 30000,
        listeners: [
            { serviceId: 'logging-service', topic: 'system.auth.request' },
            { serviceId: 'audit-service', topic: 'system.auth.request' }
        ],
        request: {
            serviceId: 'frontend-service',
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.auth.request',
                    version: '1.0.0',
                    requestId: 'req-001'
                },
                payload: { username: 'john.doe', action: 'login' }
            }
        },
        response: {
            serviceId: 'auth-service',
            priority: 1,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.auth.request',
                    version: '1.0.0',
                    requestId: 'req-001'
                },
                payload: { token: 'xyz123', expiresIn: 3600 }
            }
        },
        relatedMessages: [
            {
                action: ActionType.PUBLISH,
                topic: 'system.audit.log',
                version: '1.0.0',
                requestId: 'req-001-1',
                originatorServiceId: 'auth-service',
                responderServiceIds: ['audit-service', 'logging-service'],
                status: 'success'
            },
            {
                action: ActionType.REQUEST,
                topic: 'system.user.validate',
                version: '1.0.0',
                requestId: 'req-001-2',
                originatorServiceId: 'auth-service',
                responderServiceId: 'user-service',
                status: 'success'
            }
        ]
    },
    {
        status: 'timeout',
        receivedAt: new Date('2024-01-20T10:05:00'),
        completedAt: new Date('2024-01-20T10:05:02'),
        brokerProcessingTime: 45,
        timeout: 2000,
        request: {
            serviceId: 'user-service',
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.email.request',
                    version: '1.0.0',
                    requestId: 'req-002'
                },
                payload: { to: 'user@example.com', template: 'welcome' }
            }
        },
        response: {
            serviceId: 'email-service',
            priority: 2
        },
        error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timed out after 2000ms',
            metadata: {
                timeout: 2000,
                responderServiceId: 'email-service'
            }
        }
    },
    {
        status: 'error',
        receivedAt: new Date('2024-01-20T10:10:00'),
        completedAt: new Date('2024-01-20T10:10:01'),
        brokerProcessingTime: 30,
        timeout: 30000,
        request: {
            serviceId: 'order-service',
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.inventory.request',
                    version: '1.0.0',
                    requestId: 'req-003'
                },
                payload: { productId: '123', quantity: 5 }
            }
        },
        response: {
            serviceId: 'inventory-service',
            priority: 1,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.inventory.request',
                    version: '1.0.0',
                    requestId: 'req-003'
                },
                payload: {
                    error: {
                        code: 'INSUFFICIENT_STOCK',
                        message: 'Not enough stock available',
                        requestedQuantity: 5,
                        availableQuantity: 3
                    }
                }
            }
        },
        error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Not enough stock available',
            metadata: {
                productId: '123',
                requestedQuantity: 5,
                availableQuantity: 3
            }
        }
    },
    {
        status: 'dropped',
        receivedAt: new Date('2024-01-20T10:15:00'),
        completedAt: new Date('2024-01-20T10:15:00'),
        brokerProcessingTime: 5,
        timeout: 30000,
        request: {
            serviceId: 'catalog-service',
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.pricing.request',
                    version: '1.0.0',
                    requestId: 'req-004'
                },
                payload: { productId: '123', quantity: 1 }
            }
        },
        response: {
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.pricing.request',
                    version: '1.0.0',
                    requestId: 'req-004'
                },
                payload: {
                    error: {
                        code: 'NO_RESPONDERS',
                        message: 'No responders available for topic',
                        topic: 'system.pricing.request'
                    }
                }
            }
        },
        error: {
            code: 'NO_RESPONDERS',
            message: 'No responders available for topic',
            metadata: {
                topic: 'system.pricing.request'
            }
        }
    },
    {
        status: 'error',
        receivedAt: new Date('2024-01-20T10:20:00'),
        completedAt: new Date('2024-01-20T10:20:00'),
        brokerProcessingTime: 2,
        timeout: 30000,
        request: {
            serviceId: 'payment-service',
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.transaction.request',
                    version: '1.0.0',
                    requestId: 'req-005'
                },
                payload: { accountId: 'acc123', amount: 100.00, currency: 'USD' }
            }
        },
        response: {
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.transaction.request',
                    version: '1.0.0',
                    requestId: 'req-005'
                },
                payload: {
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Message broker internal error',
                        details: 'Failed to route message due to internal error'
                    }
                }
            }
        },
        error: {
            code: 'INTERNAL_ERROR',
            message: 'Message broker internal error',
            metadata: {
                errorId: 'mb-err-123',
                component: 'message-router',
                details: 'Failed to route message due to internal error'
            }
        }
    },
    {
        status: 'dropped',
        receivedAt: new Date('2024-01-20T10:25:00'),
        completedAt: new Date('2024-01-20T10:25:02'),
        brokerProcessingTime: 2000,
        timeout: 30000,
        request: {
            serviceId: 'order-service',
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.shipping.calculate',
                    version: '1.0.0',
                    requestId: 'req-006'
                },
                payload: {
                    orderId: 'ord123',
                    items: [
                        { productId: 'p1', quantity: 2, weight: 1.5 },
                        { productId: 'p2', quantity: 1, weight: 0.5 }
                    ],
                    destination: {
                        country: 'US',
                        zipCode: '94105'
                    }
                }
            }
        },
        response: {
            serviceId: 'shipping-service',
            priority: 1,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.shipping.calculate',
                    version: '1.0.0',
                    requestId: 'req-006'
                },
                payload: {
                    error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message: 'Message broker is busy',
                        details: 'Request dropped due to broker capacity limit'
                    }
                }
            }
        },
        error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Message broker is busy',
            metadata: {
                errorId: 'mb-err-456',
                component: 'message-queue',
                details: 'Request dropped due to broker capacity limit'
            }
        },
    }
]