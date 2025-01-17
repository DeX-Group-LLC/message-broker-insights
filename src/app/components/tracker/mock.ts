import { ActionType } from "../../services/websocket.service";
import { MessageFlow } from "./tracker.component";

export const MOCK_DATA: MessageFlow[] = [
    {
        auditors: ['logging-service', 'audit-service'],
        request: {
            serviceId: 'frontend-service',
            timeout: 30000,
            receivedAt: new Date('2024-01-20T10:00:00'),
            respondedAt: new Date('2024-01-20T10:00:01'),
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.auth.request',
                    version: '1.0.0',
                    requestid: 'req-001'
                },
                payload: { username: 'john.doe', action: 'login' }
            }
        },
        response: {
            target: {
                serviceId: 'auth-service',
                priority: 1
            },
            fromBroker: false,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.auth.request',
                    version: '1.0.0',
                    requestid: 'req-001'
                },
                payload: { token: 'xyz123', expiresIn: 3600 }
            }
        },
        relatedMessages: [
            {
                header: {
                    action: ActionType.PUBLISH,
                    topic: 'system.audit.log',
                    version: '1.0.0'
                },
                targetServiceIds: ['audit-service', 'logging-service']
            },
            {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.user.validate',
                    version: '1.0.0',
                    requestid: 'req-001-1'
                },
                targetServiceIds: ['user-service']
            }
        ]
    },
    {
        request: {
            serviceId: 'user-service',
            timeout: 2000,
            receivedAt: new Date('2024-01-20T10:05:00'),
            respondedAt: new Date('2024-01-20T10:05:02'),
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.email.request',
                    version: '1.0.0',
                    requestid: 'req-002'
                },
                payload: { timeout: 2000, to: 'user@example.com', template: 'welcome' }
            }
        },
        response: {
            target: {
                serviceId: 'email-service',
                priority: 2
            },
            fromBroker: true,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.email.request',
                    version: '1.0.0',
                    requestid: 'req-002'
                },
                payload: {
                    error: {
                        code: 'REQUEST_TIMEOUT',
                        message: 'Request timed out after 2000ms',
                        timestamp: new Date('2024-01-20T10:05:02'),
                        details: {
                            timeout: 2000,
                            responderServiceId: 'email-service'
                        }
                    }
                }
            }
        }
    },
    {
        request: {
            serviceId: 'order-service',
            timeout: 30000,
            receivedAt: new Date('2024-01-20T10:10:00'),
            respondedAt: new Date('2024-01-20T10:10:01'),
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.inventory.request',
                    version: '1.0.0',
                    requestid: 'req-003'
                },
                payload: { productId: '123', quantity: 5 }
            }
        },
        response: {
            target: {
                serviceId: 'inventory-service',
                priority: 2
            },
            fromBroker: false,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.inventory.request',
                    version: '1.0.0',
                    requestid: 'req-003'
                },
                payload: {
                    error: {
                        code: 'INSUFFICIENT_STOCK',
                        message: 'Not enough stock available',
                        timestamp: new Date('2024-01-20T10:10:01'),
                        details: {
                            requestedQuantity: 5,
                            availableQuantity: 3
                        }
                    }
                }
            }
        }
    },
    {
        request: {
            serviceId: 'catalog-service',
            timeout: 30000,
            receivedAt: new Date('2024-01-20T10:15:00'),
            respondedAt: new Date('2024-01-20T10:15:00'),
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.pricing.request',
                    version: '1.0.0',
                    requestid: 'req-004'
                },
                payload: { productId: '123', quantity: 1 }
            }
        },
        response: {
            fromBroker: true,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.pricing.request',
                    version: '1.0.0',
                    requestid: 'req-004'
                },
                payload: {
                    error: {
                        code: 'NO_RESPONDERS',
                        message: 'No responders available for topic',
                        timestamp: new Date('2024-01-20T10:15:00'),
                        details: {
                            topic: 'system.pricing.request'
                        }
                    }
                }
            }
        }
    },
    {
        request: {
            serviceId: 'payment-service',
            timeout: 30000,
            receivedAt: new Date('2024-01-20T10:20:00'),
            respondedAt: new Date('2024-01-20T10:20:00'),
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.transaction.request',
                    version: '1.0.0',
                    requestid: 'req-005'
                },
                payload: { accountId: 'acc123', amount: 100.00, currency: 'USD' }
            }
        },
        response: {
            fromBroker: true,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.transaction.request',
                    version: '1.0.0',
                    requestid: 'req-005'
                },
                payload: {
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Message broker internal error',
                        timestamp: new Date('2024-01-20T10:20:00'),
                            details: {
                            error: 'Failed to route message due to internal error'
                        }
                    }
                }
            }
        }
    },
    {
        request: {
            serviceId: 'order-service',
            timeout: 30000,
            receivedAt: new Date('2024-01-20T10:25:00'),
            respondedAt: new Date('2024-01-20T10:25:02'),
            message: {
                header: {
                    action: ActionType.REQUEST,
                    topic: 'system.shipping.calculate',
                    version: '1.0.0',
                    requestid: 'req-006'
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
            target: {
                serviceId: 'shipping-service',
                priority: 1
            },
            fromBroker: true,
            message: {
                header: {
                    action: ActionType.RESPONSE,
                    topic: 'system.shipping.calculate',
                    version: '1.0.0',
                    requestid: 'req-006'
                },
                payload: {
                    error: {
                        code: 'SERVICE_UNAVAILABLE',
                        message: 'Message broker is busy',
                        timestamp: new Date('2024-01-20T10:25:02'),
                        details: {
                            error: 'Request dropped due to broker capacity limit'
                        }
                    }
                }
            }
        }
    }
]